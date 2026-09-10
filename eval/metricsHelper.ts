export interface ClassificationMetrics {
  accuracy: number;
  macroPrecision: number;
  macroRecall: number;
  macroF1: number;
  perClass: Record<string, { precision: number; recall: number; f1: number; support: number }>;
}

export interface BinaryMetrics {
  accuracy: number;
  precision: number;
  recall: number;
  f1: number;
  truePositives: number;
  falsePositives: number;
  trueNegatives: number;
  falseNegatives: number;
}

export function computeClassificationMetrics(
  groundTruths: string[],
  predictions: string[]
): ClassificationMetrics {
  const classes = Array.from(new Set([...groundTruths, ...predictions])).sort();
  const perClass: Record<string, { precision: number; recall: number; f1: number; support: number }> = {};

  let totalCorrect = 0;
  for (let i = 0; i < groundTruths.length; i++) {
    if (groundTruths[i] === predictions[i]) {
      totalCorrect++;
    }
  }

  const accuracy = groundTruths.length > 0 ? totalCorrect / groundTruths.length : 0;

  let sumPrecision = 0;
  let sumRecall = 0;
  let sumF1 = 0;

  for (const c of classes) {
    let tp = 0;
    let fp = 0;
    let fn = 0;
    let support = 0;

    for (let i = 0; i < groundTruths.length; i++) {
      const actual = groundTruths[i];
      const pred = predictions[i];

      if (actual === c) support++;
      if (actual === c && pred === c) tp++;
      if (actual !== c && pred === c) fp++;
      if (actual === c && pred !== c) fn++;
    }

    const precision = tp + fp > 0 ? tp / (tp + fp) : 0;
    const recall = tp + fn > 0 ? tp / (tp + fn) : 0;
    const f1 = precision + recall > 0 ? (2 * precision * recall) / (precision + recall) : 0;

    perClass[c] = {
      precision: Number(precision.toFixed(4)),
      recall: Number(recall.toFixed(4)),
      f1: Number(f1.toFixed(4)),
      support,
    };

    sumPrecision += precision;
    sumRecall += recall;
    sumF1 += f1;
  }

  const numClasses = classes.length || 1;
  return {
    accuracy: Number(accuracy.toFixed(4)),
    macroPrecision: Number((sumPrecision / numClasses).toFixed(4)),
    macroRecall: Number((sumRecall / numClasses).toFixed(4)),
    macroF1: Number((sumF1 / numClasses).toFixed(4)),
    perClass,
  };
}

export function computeBinaryMetrics(
  groundTruths: boolean[],
  predictions: boolean[]
): BinaryMetrics {
  let tp = 0;
  let fp = 0;
  let tn = 0;
  let fn = 0;

  for (let i = 0; i < groundTruths.length; i++) {
    const act = groundTruths[i];
    const pred = predictions[i];

    if (act && pred) tp++;
    if (!act && pred) fp++;
    if (!act && !pred) tn++;
    if (act && !pred) fn++;
  }

  const total = groundTruths.length || 1;
  const accuracy = (tp + tn) / total;
  const precision = tp + fp > 0 ? tp / (tp + fp) : 0;
  const recall = tp + fn > 0 ? tp / (tp + fn) : 0;
  const f1 = precision + recall > 0 ? (2 * precision * recall) / (precision + recall) : 0;

  return {
    accuracy: Number(accuracy.toFixed(4)),
    precision: Number(precision.toFixed(4)),
    recall: Number(recall.toFixed(4)),
    f1: Number(f1.toFixed(4)),
    truePositives: tp,
    falsePositives: fp,
    trueNegatives: tn,
    falseNegatives: fn,
  };
}
