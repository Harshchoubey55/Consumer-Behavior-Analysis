"""
orchestrator.py
===============
Agent Orchestrator for the Consumer Behavior Analytics Pipeline.

Replaces the monolithic sequential pipeline with an agent-based system
where each processing stage is an autonomous agent. The orchestrator:

  1. Generates a unique run_id per pipeline invocation.
  2. Builds the dependency graph for all agents.
  3. Runs agents in parallel where their dependencies are satisfied,
     using a thread pool (each agent gets its own DB connection).
  4. Writes all execution metadata to the agent_runs table so the
     dashboard's /agents page can show live pipeline health.

Agent execution model:
  ┌─ SessionizationAgent ──────────────────────────────────────────┐
  │  ProductAnalyticsAgent ─────┐                                  │
  │  UserFeatureAgent ──────────┤── RecommendationAgent            │
  │  KPIAgent ──────────────────┘                                  │
  │  FunnelAgent ──────────────────────────────────────────────────┤
  │  SequenceModelAgent ────────── AnomalyDetectionAgent ──────────┤
  │  ContextAnalysisAgent ─────── PhenotypeAgent ──────────────────┤
  │                               EvaluationAgent (full only) ──────┤
  │                               InterventionAgent ───────────────┤
  │                               FedAvgAgent (full only) ──────────┘
  └─────────────────────────────────────────────────────────────────
"""

import logging
import uuid
import sys
import os
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
from typing import Dict, List, Optional, Type

import psycopg2
import psycopg2.extras

from agent_base import BaseAgent, AgentStatus, InsufficientDataError

log = logging.getLogger(__name__)

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://postgres:postgres@localhost:5432/analytics_db"
)


def _get_conn():
    return psycopg2.connect(DATABASE_URL, cursor_factory=psycopg2.extras.RealDictCursor)


# ── Import all concrete agents ──────────────────────────────────────────────
# Lazy import inside the function to keep agent files self-contained

def _load_agents(mode: str) -> List[BaseAgent]:
    """Return an ordered list of all agent instances for the given mode."""
    sys.path.insert(0, os.path.dirname(__file__))

    from pipeline_agents import (
        SessionizationAgent,
        ProductAnalyticsAgent,
        UserFeatureAgent,
        KPIAgent,
        FunnelAgent,
        RecommendationAgent,
        SequenceModelAgent,
        ContextAnalysisAgent,
        InterventionAgent,
        AnomalyDetectionAgent,
    )

    agents: List[BaseAgent] = [
        SessionizationAgent(),
        ProductAnalyticsAgent(),
        UserFeatureAgent(),
        KPIAgent(),
        FunnelAgent(),
        RecommendationAgent(),
        SequenceModelAgent(),
        ContextAnalysisAgent(),
        InterventionAgent(),
        AnomalyDetectionAgent(),
    ]

    if mode == "full":
        try:
            from phenotype_classifier import PhenotypeAgent
            agents.append(PhenotypeAgent())
        except Exception as e:
            log.warning(f"PhenotypeAgent unavailable: {e}")

        try:
            from evaluation_engine import EvaluationAgent
            agents.append(EvaluationAgent())
        except Exception as e:
            log.warning(f"EvaluationAgent unavailable: {e}")

        try:
            from fedavg_aggregator import FedAvgAgent
            agents.append(FedAvgAgent())
        except Exception as e:
            log.warning(f"FedAvgAgent unavailable: {e}")

    return agents


class AgentOrchestrator:
    """
    Executes pipeline agents in dependency order with parallelism.

    Architecture:
      - Each agent gets its own DB connection (thread-safe).
      - Agents whose dependencies are all COMPLETED run in parallel.
      - FAILED agents block their dependents (they become SKIPPED).
      - SKIPPED agents (soft failure) do NOT block dependents.
      - All execution state is persisted to agent_runs table.
    """

    MAX_WORKERS = 4  # matches typical Docker CPU allocation

    def __init__(self, mode: str = "incremental"):
        self.mode = mode
        self.run_id = str(uuid.uuid4())
        self.agents: Dict[str, BaseAgent] = {}  # name → agent
        self._completed: set = set()
        self._failed: set = set()

    def _build_graph(self):
        agents_list = _load_agents(self.mode)
        for a in agents_list:
            a.set_context(self.run_id, self.mode)
            self.agents[a.name] = a
        log.info(f"[Orchestrator] Loaded {len(self.agents)} agents for mode={self.mode}")

    def _ready_agents(self) -> List[BaseAgent]:
        """Return agents whose dependencies are all satisfied (completed or skipped)."""
        done = self._completed | self._failed
        ready = []
        for name, agent in self.agents.items():
            if agent.status in (AgentStatus.COMPLETED, AgentStatus.FAILED,
                                AgentStatus.SKIPPED, AgentStatus.RUNNING):
                continue
            deps_ok = all(
                self.agents.get(dep, None) is not None and
                self.agents[dep].status in (AgentStatus.COMPLETED, AgentStatus.SKIPPED)
                for dep in agent.dependencies
            )
            deps_failed = any(
                self.agents.get(dep, None) is not None and
                self.agents[dep].status == AgentStatus.FAILED
                for dep in agent.dependencies
            )
            if deps_failed:
                # Hard-fail upstream → skip this agent
                conn = _get_conn()
                try:
                    agent.skip(conn, f"Upstream agent failed: {agent.dependencies}")
                    self._failed.add(name)
                finally:
                    conn.close()
            elif deps_ok:
                ready.append(agent)
        return ready

    def _run_agent(self, agent: BaseAgent) -> bool:
        """Execute a single agent in its own thread with its own connection."""
        conn = _get_conn()
        try:
            return agent.execute(conn)
        finally:
            conn.close()

    def run(self):
        """Main orchestration loop. Runs until all agents are settled."""
        log.info("=" * 60)
        log.info(f"[Orchestrator] Pipeline starting | run_id={self.run_id} | mode={self.mode}")
        log.info("=" * 60)

        self._build_graph()
        t_start = time.time()

        with ThreadPoolExecutor(max_workers=self.MAX_WORKERS) as pool:
            futures = {}  # future → agent_name

            # Initial scheduling pass
            for agent in self._ready_agents():
                agent.status = AgentStatus.RUNNING
                f = pool.submit(self._run_agent, agent)
                futures[f] = agent.name

            while futures:
                done_futures = set()
                for f in as_completed(futures, timeout=600):
                    name = futures[f]
                    done_futures.add(f)
                    try:
                        success = f.result()
                    except Exception as e:
                        success = False
                        log.error(f"[Orchestrator] Unhandled exception from {name}: {e}")

                    if success:
                        self._completed.add(name)
                    else:
                        agent = self.agents[name]
                        if agent.status == AgentStatus.SKIPPED:
                            self._completed.add(name)  # skipped = soft ok for deps
                        else:
                            self._failed.add(name)

                    # Schedule newly ready agents
                    for ready_agent in self._ready_agents():
                        if ready_agent.name not in futures.values():
                            ready_agent.status = AgentStatus.RUNNING
                            f2 = pool.submit(self._run_agent, ready_agent)
                            futures[f2] = ready_agent.name

                for f in done_futures:
                    futures.pop(f, None)

        elapsed = time.time() - t_start
        n_ok = len(self._completed)
        n_fail = len(self._failed)

        log.info("=" * 60)
        log.info(f"[Orchestrator] Pipeline complete in {elapsed:.1f}s | "
                 f"completed={n_ok} | failed={n_fail}")
        if self._failed:
            log.warning(f"[Orchestrator] Failed agents: {sorted(self._failed)}")
        log.info("=" * 60)

        return {
            "run_id": self.run_id,
            "mode": self.mode,
            "completed": n_ok,
            "failed": n_fail,
            "elapsed_s": round(elapsed, 2),
        }
