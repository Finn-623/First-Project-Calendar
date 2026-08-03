export const scheduleAfterPaint = (task) => {
  const enqueueTask = () => window.setTimeout(task, 0);

  if (typeof window.requestAnimationFrame === 'function') {
    window.requestAnimationFrame(enqueueTask);
    return;
  }

  enqueueTask();
};
