const BASE_URL = "http://192.168.1.85:8000";//cambiar segun el pc

export const ENDPOINTS = {
  GET_TOKEN: `${BASE_URL}/token`,

  // Lotes
  LAST_BATCH: `${BASE_URL}/product_batch/last-today`,
  POST_BATCH: `${BASE_URL}/product_batch/`,

  // Productos
  GET_PRODUCT: `${BASE_URL}/product/`,
  POST_PRODUCT: `${BASE_URL}/product/`,

  // Usuarios
  GET_USER: `${BASE_URL}/users/`,
  POST_USER: `${BASE_URL}/users/`,
  PATCH_USER: (id: number | string) => `${BASE_URL}/users/${id}`,
};
