import { NextResponse } from 'next/server';
import { query } from '../../../../lib/db';

export const runtime = 'nodejs';
export const revalidate = 300;

export async function GET() {
  try {
    // Model evaluation results — latest run per model
    const modelResults = await query<{
      model_name: string;
      n_train: number;
      n_test: number;
      n_total: number;
      auc_roc: string;
      avg_precision: string;
      accuracy: string;
      cv_auc_mean: string;
      cv_auc_std: string;
      positive_rate: string;
      feature_set: string;
      notes: string;
      run_at: string;
    }>(`
      SELECT
        model_name, n_train, n_test, n_total,
        ROUND(auc_roc::NUMERIC, 4)::TEXT       AS auc_roc,
        ROUND(avg_precision::NUMERIC, 4)::TEXT  AS avg_precision,
        ROUND(accuracy::NUMERIC, 4)::TEXT       AS accuracy,
        ROUND(cv_auc_mean::NUMERIC, 4)::TEXT    AS cv_auc_mean,
        ROUND(cv_auc_std::NUMERIC, 4)::TEXT     AS cv_auc_std,
        ROUND(positive_rate::NUMERIC, 4)::TEXT  AS positive_rate,
        feature_set, notes,
        TO_CHAR(run_at, 'Mon DD HH24:MI') AS run_at
      FROM model_evaluation_results
      WHERE is_latest = TRUE
      ORDER BY
        CASE feature_set WHEN 'count_only' THEN 1 ELSE 2 END,
        auc_roc DESC
    `);

    // Regression coefficients with p-values
    const coefficients = await query<{
      feature_name: string;
      coefficient: string;
      std_error: string;
      p_value: string;
      odds_ratio: string;
      ci_lower: string;
      ci_upper: string;
      is_significant: boolean;
      interpretation: string;
    }>(`
      SELECT
        mc.feature_name,
        ROUND(mc.coefficient::NUMERIC, 4)::TEXT  AS coefficient,
        ROUND(mc.std_error::NUMERIC, 4)::TEXT    AS std_error,
        ROUND(mc.p_value::NUMERIC, 6)::TEXT      AS p_value,
        ROUND(mc.odds_ratio::NUMERIC, 4)::TEXT   AS odds_ratio,
        ROUND(mc.ci_lower::NUMERIC, 4)::TEXT     AS ci_lower,
        ROUND(mc.ci_upper::NUMERIC, 4)::TEXT     AS ci_upper,
        mc.is_significant,
        mc.interpretation
      FROM model_coefficients mc
      JOIN model_evaluation_results mer
        ON mer.run_id = mc.run_id AND mer.is_latest = TRUE
        AND mer.model_name = 'LogisticRegression_ContextAware'
      ORDER BY ABS(mc.coefficient::NUMERIC) DESC
    `);

    // Feature importance from Random Forest
    const featureImportance = await query<{
      feature_name: string;
      importance: string;
      std_dev: string;
      rank: number;
    }>(`
      SELECT fi.feature_name,
             ROUND(fi.importance::NUMERIC, 4)::TEXT AS importance,
             ROUND(fi.std_dev::NUMERIC, 4)::TEXT    AS std_dev,
             fi.rank
      FROM feature_importance fi
      JOIN model_evaluation_results mer
        ON mer.run_id = fi.run_id AND mer.is_latest = TRUE
        AND mer.model_name = 'RandomForest_ContextAware'
      ORDER BY fi.rank
      LIMIT 14
    `);

    // Behavioral effects (hypothesis test results)
    const behavioralEffects = await query<{
      effect_name: string;
      effect_type: string;
      description: string;
      coefficient: string;
      p_value: string;
      effect_size: string;
      sample_n: number;
      is_significant: boolean;
      direction: string;
      interpretation: string;
      generated_at: string;
    }>(`
      SELECT
        effect_name, effect_type, description,
        ROUND(coefficient::NUMERIC, 4)::TEXT  AS coefficient,
        ROUND(p_value::NUMERIC, 6)::TEXT      AS p_value,
        ROUND(effect_size::NUMERIC, 4)::TEXT  AS effect_size,
        sample_n, is_significant, direction, interpretation,
        TO_CHAR(generated_at, 'Mon DD HH24:MI') AS generated_at
      FROM behavioral_effects
      ORDER BY is_significant DESC, ABS(effect_size::NUMERIC) DESC
    `);

    // AUC comparison summary
    const countOnlyAUC = modelResults.find(r => r.feature_set === 'count_only')?.auc_roc || null;
    const contextAUC   = modelResults.find(r => r.model_name === 'LogisticRegression_ContextAware')?.auc_roc || null;
    const rfAUC        = modelResults.find(r => r.model_name === 'RandomForest_ContextAware')?.auc_roc || null;

    const aucComparison = {
      count_only:   countOnlyAUC ? parseFloat(countOnlyAUC) : null,
      context_lr:   contextAUC   ? parseFloat(contextAUC)   : null,
      context_rf:   rfAUC        ? parseFloat(rfAUC)        : null,
      improvement_lr: countOnlyAUC && contextAUC
        ? Math.round((parseFloat(contextAUC) - parseFloat(countOnlyAUC)) * 10000) / 10000
        : null,
      improvement_rf: countOnlyAUC && rfAUC
        ? Math.round((parseFloat(rfAUC) - parseFloat(countOnlyAUC)) * 10000) / 10000
        : null,
    };

    // Data quality / sample size warning
    const totalN = modelResults[0]?.n_total || 0;
    const dataWarning = totalN < 200
      ? `⚠ Small sample (n=${totalN}). Results are preliminary — collect 500+ real sessions for reliable conclusions.`
      : totalN < 500
      ? `Sample size is adequate (n=${totalN}) for preliminary findings. Larger samples will improve reliability.`
      : `Sample size is sufficient (n=${totalN}) for reliable conclusions.`;

    return NextResponse.json({
      modelResults,
      coefficients,
      featureImportance,
      behavioralEffects,
      aucComparison,
      dataWarning,
      hasResults: modelResults.length > 0,
    });

  } catch (error) {
    console.error('[evaluation] Error:', error);
    return NextResponse.json({ error: 'Failed to load evaluation results', hasResults: false }, { status: 500 });
  }
}
