/**
 * @typedef {Object} NormalizedMaterial
 * @property {string} supplierCode
 * @property {string} name
 * @property {'BOARD'|'HDF'|'EDGE'|'FRONT'} category
 * @property {number} thickness
 * @property {number|null} widthMm
 * @property {number|null} heightMm
 * @property {boolean} inStock
 * @property {number} price
 * @property {'M2'|'BM'|'PC'|'PACK'} unit
 */

/**
 * @typedef {Object} NormalizedHardware
 * @property {string} supplierCode
 * @property {string} name
 * @property {'HINGE'|'DRAWER_SLIDE'|'HANDLE'|'SHELF_PIN'|'OTHER'} type
 * @property {number} packQty
 * @property {boolean} inStock
 * @property {number} price
 * @property {'PC'|'PACK'} unit
 */

export {};
