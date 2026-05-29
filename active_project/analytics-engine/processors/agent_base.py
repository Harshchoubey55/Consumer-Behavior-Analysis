"""
agent_base.py
=============
Base class for all analytics pipeline agents.

Each agent in the system is a specialized, autonomous processor
that manages its own domain of the behavioral analytics pipeline.

Design principles:
  - Each agent declares its dependencies explicitly.
  - Agents report health metrics after every run.
  - The Orchestrator uses these to schedule parallel execution
    and skip downstream agents when upstream agents fail.
  - Database (PostgreSQL) is the shared message bus — agents
    communicate through table state, not in-memory queues.

Usage (via Orchestrator):
  orchestrator = AgentOrchestrator(conn, run_id, mode)
  orchestrator.run()
"""

import logging
import time
from abc import ABC, abstractmethod
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
import uuid

log = logging.getLogger(__name__)


class AgentStatus:
    PENDING   = "PENDING"
    RUNNING   = "RUNNING"
    COMPLETED = "COMPLETED"
    FAILED    = "FAILED"
    SKIPPED   = "SKIPPED"


class BaseAgent(ABC):
    """
    Abstract base for all pipeline agents.

    Subclasses must implement:
      - name (class attribute) — unique identifier
      - description (class attribute) — what this agent does
      - dependencies (class attribute) — list of agent names this needs first
      - run(conn) — the agent's core logic
      - check_health(conn) — verify outputs are valid, return dict of metrics
    """

    name: str = "BaseAgent"
    description: str = "Abstract base agent"
    version: str = "1.0"
    dependencies: List[str] = []   # agent names that must COMPLETE before this runs

    def __init__(self):
        self.status: str = AgentStatus.PENDING
        self.run_id: Optional[str] = None
        self.pipeline_mode: str = "incremental"
        self._db_log_id: Optional[int] = None

    def set_context(self, run_id: str, pipeline_mode: str):
        self.run_id = run_id
        self.pipeline_mode = pipeline_mode

    # ── DB-level run logging ─────────────────────────────────────────

    def _log_start(self, conn):
        """Write RUNNING status to agent_runs table."""
        with conn.cursor() as cur:
            cur.execute("""
                INSERT INTO agent_runs
                    (run_id, pipeline_mode, agent_name, agent_version, status, started_at)
                VALUES (%s, %s, %s, %s, %s, %s)
                RETURNING id
            """, (
                self.run_id, self.pipeline_mode,
                self.name, self.version, AgentStatus.RUNNING,
                datetime.now(timezone.utc)
            ))
            self._db_log_id = cur.fetchone()["id"]
        conn.commit()

    def _log_complete(self, conn, duration_ms: int, rows_processed: int, health: Dict):
        """Write COMPLETED status and health metrics."""
        with conn.cursor() as cur:
            cur.execute("""
                UPDATE agent_runs SET
                    status        = %s,
                    completed_at  = %s,
                    duration_ms   = %s,
                    rows_processed= %s,
                    health_checks = %s
                WHERE id = %s
            """, (
                AgentStatus.COMPLETED, datetime.now(timezone.utc),
                duration_ms, rows_processed,
                __import__("json").dumps(health),
                self._db_log_id
            ))
        conn.commit()

    def _log_failure(self, conn, error: str):
        """Write FAILED status with error message."""
        with conn.cursor() as cur:
            cur.execute("""
                UPDATE agent_runs SET
                    status        = %s,
                    completed_at  = %s,
                    error_message = %s
                WHERE id = %s
            """, (
                AgentStatus.FAILED, datetime.now(timezone.utc),
                error[:2000], self._db_log_id
            ))
        conn.commit()

    def _log_skipped(self, conn, reason: str):
        """Write SKIPPED status (e.g., mode gate, insufficient data)."""
        with conn.cursor() as cur:
            cur.execute("""
                INSERT INTO agent_runs
                    (run_id, pipeline_mode, agent_name, agent_version,
                     status, started_at, completed_at, error_message)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
            """, (
                self.run_id, self.pipeline_mode,
                self.name, self.version, AgentStatus.SKIPPED,
                datetime.now(timezone.utc), datetime.now(timezone.utc),
                reason
            ))
        conn.commit()

    # ── Public execution entrypoint ──────────────────────────────────

    def execute(self, conn) -> bool:
        """
        Called by the Orchestrator. Wraps run() with timing, logging, error handling.
        Returns True if completed successfully, False otherwise.
        """
        log.info(f"[{self.name}] Starting...")
        self.status = AgentStatus.RUNNING
        self._log_start(conn)
        t0 = time.time()

        try:
            rows, health = self.run(conn)
            duration_ms = int((time.time() - t0) * 1000)
            self.status = AgentStatus.COMPLETED
            self._log_complete(conn, duration_ms, rows or 0, health or {})
            log.info(f"[{self.name}] Completed in {duration_ms}ms | rows={rows}")
            return True

        except InsufficientDataError as e:
            duration_ms = int((time.time() - t0) * 1000)
            self.status = AgentStatus.SKIPPED
            self._log_skipped(conn, str(e))
            log.warning(f"[{self.name}] Skipped: {e}")
            return False  # treat as soft failure — don't block unrelated agents

        except Exception as e:
            self.status = AgentStatus.FAILED
            self._log_failure(conn, str(e))
            log.error(f"[{self.name}] FAILED: {e}", exc_info=True)
            return False

    def skip(self, conn, reason: str):
        """Mark agent as skipped without attempting to run."""
        self.status = AgentStatus.SKIPPED
        self._log_skipped(conn, reason)
        log.info(f"[{self.name}] Skipped — {reason}")

    # ── Abstract interface ───────────────────────────────────────────

    @abstractmethod
    def run(self, conn) -> tuple:
        """
        Execute the agent's core logic.
        Returns: (rows_processed: int, health_metrics: dict)
        Raise InsufficientDataError for graceful skips.
        Raise any other Exception for hard failures.
        """
        ...

    @abstractmethod
    def check_health(self, conn) -> Dict[str, Any]:
        """
        Check the validity of this agent's outputs.
        Returns a dict of metrics (e.g. {'row_count': 150, 'max_staleness_s': 300}).
        Called by the Orchestrator after completion for monitoring.
        """
        ...


class InsufficientDataError(Exception):
    """
    Raised when an agent cannot run due to not enough input data.
    This is a SOFT failure — the Orchestrator treats it as SKIPPED,
    not as a pipeline failure.
    """
    pass
