export const getSwipeTargetIndex = (current, count, delta) => delta > 0 ? (current - 1 + count) % count : (current + 1) % count;
