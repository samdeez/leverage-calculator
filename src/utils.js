export const calculatePercentChange = (enterPrice, exitPrice) => {
  return ((exitPrice - enterPrice) / enterPrice) * 100;
};
