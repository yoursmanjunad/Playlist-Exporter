export function getConfidenceLevel(score) {

  if (score >= 85) {
    return {
      level: "high",
      shouldTransfer: true,
    };
  }


  if (score >= 65) {
    return {
      level: "medium",
      shouldTransfer: true,
    };
  }


  if (score >= 45) {
    return {
      level: "low",
      shouldTransfer: false,
    };
  }


  return {
    level: "very_low",
    shouldTransfer: false,
  };

}