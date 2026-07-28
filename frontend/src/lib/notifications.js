import { toast } from 'sonner';

export const SUCCESS_TOAST_DURATION_MS = 2000;

export const showSuccess = (message, options = {}) => toast.success(message, {
  duration: SUCCESS_TOAST_DURATION_MS,
  id: options.id || `success:${String(message)}`,
  ...options,
});
