const mxn = new Intl.NumberFormat("es-MX", {
  style: "currency",
  currency: "MXN",
  maximumFractionDigits: 2,
});

const num = new Intl.NumberFormat("es-MX", {
  maximumFractionDigits: 2,
});

export const formatMoney = (n: number) => mxn.format(n);
export const formatNumber = (n: number) => num.format(n);
