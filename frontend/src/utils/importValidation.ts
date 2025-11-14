// frontend/src/utils/importValidation.ts

/**
 * Validate import form options
 */
export const validateImportOptions = (options: {
  startDate?: string;
  endDate?: string;
  maxGames?: string;
}): { valid: boolean; error?: string } => {
  // Validate date range
  if (options.startDate && options.endDate) {
    const start = new Date(options.startDate);
    const end = new Date(options.endDate);

    if (start > end) {
      return { valid: false, error: "Start date must be before end date" };
    }
  }

  // Validate maxGames
  if (options.maxGames) {
    const maxGames = parseInt(options.maxGames);
    if (isNaN(maxGames)) {
      return { valid: false, error: "Max games must be a number" };
    }
    if (maxGames < 1) {
      return { valid: false, error: "Max games must be at least 1" };
    }
    if (maxGames > 1000) {
      return { valid: false, error: "Max games cannot exceed 1000" };
    }
  }

  return { valid: true };
};

/**
 * Prepare import options for API
 */
export const prepareImportOptions = (options: {
  startDate?: string;
  endDate?: string;
  maxGames?: string;
}): {
  startDate?: string;
  endDate?: string;
  maxGames?: number;
} => {
  const prepared: {
    startDate?: string;
    endDate?: string;
    maxGames?: number;
  } = {};

  if (options.startDate) {
    prepared.startDate = new Date(options.startDate).toISOString();
  }

  if (options.endDate) {
    prepared.endDate = new Date(options.endDate).toISOString();
  }

  if (options.maxGames) {
    const maxGames = parseInt(options.maxGames);
    if (!isNaN(maxGames) && maxGames > 0) {
      prepared.maxGames = maxGames;
    }
  }

  return prepared;
};

/**
 * Get default import date range (3 months ago to today)
 */
export const getDefaultImportDates = (): { startDate: string; endDate: string } => {
  const today = new Date();
  const threeMonthsAgo = new Date();
  threeMonthsAgo.setMonth(today.getMonth() - 3);

  return {
    startDate: threeMonthsAgo.toISOString().split('T')[0],
    endDate: today.toISOString().split('T')[0]
  };
};
