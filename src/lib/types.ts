// src/lib/types.ts

export interface Product {
  id: number;
  codigo_produto: string;
  descricao: string;
  // saldo_estoque foi removido daqui
}

export interface ProductCount {
  id: number;
  codigo_de_barras: string;
  codigo_produto: string;
  descricao: string;
  quant_loja: number;
  quant_estoque: number;
  // saldo_estoque e total foram removidos daqui
  local_estoque: string;
  data_hora: string;
}

// O resto dos tipos pode ser removido, pois não estão a ser usados no novo fluxo.
