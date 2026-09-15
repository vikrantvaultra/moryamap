/** Browser-side glue between locked features and the payment sheet. */

/** Dispatched by a locked feature to open the payment sheet. */
export const SEVA_OPEN_EVENT = 'morya:seva-open';
/** Dispatched by the payment sheet once this device is unlocked. */
export const SEVA_PAID_EVENT = 'morya:seva-paid';

/** The pass cookie is readable by JS so locked features can open without a request. */
export const hasPass = () => /(?:^|;\s*)morya_seva=[^;]+/.test(document.cookie);
