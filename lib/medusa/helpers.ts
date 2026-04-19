import { isEmpty } from '../utils';
import { MedusaProductVariant, Money, RegionInfo } from './types';

type ComputeAmountParams = {
  amount: number;
  region: RegionInfo;
  includeTaxes?: boolean;
};

/**
 * Takes an amount, a region, and returns the amount as a decimal including or excluding taxes
 */
export const computeAmount = ({ amount, region, includeTaxes = true }: ComputeAmountParams) => {
  const toDecimal = convertToDecimal(amount, region.currency_code);

  const taxRate = includeTaxes ? getTaxRate(region) : 0;

  const amountWithTaxes = toDecimal * (1 + taxRate);

  return amountWithTaxes;
};

/**
 * Takes a product variant, and returns the amount as a decimal including or excluding taxes and the currency code
 */
export const calculateVariantAmount = (variant: MedusaProductVariant | undefined | null): Money => {
  // Some variants (especially in custom/dev data) may not have prices defined.
  // Guard against missing arrays and fall back to a sane default to avoid runtime errors.
  let currencyCode = 'USD';
  let rawAmount = 0;

  if (variant && Array.isArray(variant.prices) && variant.prices.length > 0) {
    const price = variant.prices[0];
    if (price) {
      currencyCode = (price.currency_code || 'USD').toUpperCase();
      rawAmount = Number(price.amount) || 0;
    }
  }

  const amount = convertToDecimal(rawAmount, currencyCode).toString();
  return {
    amount,
    currencyCode
  };
};

// we should probably add a more extensive list
const noDivisionCurrencies = ['krw', 'jpy', 'vnd'];

export const convertToDecimal = (amount: number | undefined | null, currencyCode = 'USD') => {
  const safeAmount = Number(amount) || 0;
  const divisor = noDivisionCurrencies.includes(currencyCode.toLowerCase()) ? 1 : 100;

  return Math.floor(safeAmount) / divisor;
};

const getTaxRate = (region?: RegionInfo) => {
  return region && !isEmpty(region) ? region?.tax_rate / 100 : 0;
};
