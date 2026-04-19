import clsx from 'clsx';

const Price = ({
  amount,
  className,
  currencyCode = 'USD',
  currencyCodeClassName
}: {
  amount: string;
  className?: string;
  currencyCode: string;
  currencyCodeClassName?: string;
} & React.ComponentProps<'p'>) => {
  // Fallback to a safe default if the currency code is missing or empty to avoid runtime errors.
  const safeCurrencyCode = currencyCode && currencyCode.trim() ? currencyCode : 'USD';

  return (
    <p suppressHydrationWarning={true} className={className}>
      {`${new Intl.NumberFormat(undefined, {
        style: 'currency',
        currency: safeCurrencyCode,
        currencyDisplay: 'narrowSymbol'
      }).format(parseFloat(amount))}`}
      <span className={clsx('ml-1 inline', currencyCodeClassName)}>{`${safeCurrencyCode}`}</span>
    </p>
  );
};

export default Price;
