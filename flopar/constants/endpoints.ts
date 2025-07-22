const BASE_URL = "http://192.168.1.80:8000";//cambiar segun el pc

export const ENDPOINTS = {
  GET_TOKEN: `${BASE_URL}/token`,

  // Lotes
  LAST_BATCH: `${BASE_URL}/product_batch/last-today`,
  POST_BATCH: `${BASE_URL}/product_batch/`,

  // Productos
  GET_PRODUCT: `${BASE_URL}/product/`,
  GET_PRODUCT_DETAIL: (id: number | string) => `${BASE_URL}/product/${id}`,
  POST_PRODUCT: `${BASE_URL}/product/`,
  GET_PRODUCTS_FILTERED: (searchTerm: string, batchId: number | string) =>
    `${BASE_URL}/product/search-product/?query=${encodeURIComponent(searchTerm)}&batch_id=${batchId}`,
  PATCH_PRODUCT: (id: number | string) => `${BASE_URL}/product/${id}`,
  CONFIRM_QUADRATURE: (patente: string) => `${BASE_URL}/product/patente/${encodeURIComponent(patente)}/confirm-quadrature`,



  // Usuarios
  GET_USER: `${BASE_URL}/users/`,
  POST_USER: `${BASE_URL}/users/`,
  PATCH_USER: (id: number | string) => `${BASE_URL}/users/${id}`,
};
