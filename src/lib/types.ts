// src/lib/types.ts

export interface Product {
  id: number;
  codigo_produto: string;
  descricao: string;
}

export interface ProductCount {
  id: number;
  codigo_de_barras: string;
  codigo_produto: string;
  descricao: string;
  quant_loja: number;
  quant_estoque: number;
  data_validade?: string | null;
  local_estoque: string;
  data_hora: string;
}
