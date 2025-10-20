import { NextResponse } from "next/server";
import { prisma } from "@/src/lib/prisma";

// Define o ID do usuário que representa o Catálogo Mestre.
// Toda consulta será feita nos produtos deste usuário.
const MASTER_CATALOG_USER_ID = 1;

export async function GET(
  request: Request,
  { params }: { params: { userId: string; code: string } }
) {
  try {
    const { code } = params;
    const userId = parseInt(params.userId, 10); // O ID do usuário logado

    if (isNaN(userId) || !code) {
      return NextResponse.json(
        { error: "ID de usuário ou código do produto inválido" },
        { status: 400 }
      );
    }

    // 1. Tenta encontrar pelo código de barras no catálogo mestre
    const barCode = await prisma.codigoBarras.findUnique({
      where: {
        codigo_de_barras_usuario_id: {
          codigo_de_barras: code,
          usuario_id: MASTER_CATALOG_USER_ID, // Busca sempre no usuário 1
        },
      },
      include: {
        produto: true,
      },
    });

    if (barCode && barCode.produto) {
      return NextResponse.json(barCode.produto);
    }

    // 2. Se não encontrar, tenta pelo código interno do produto no catálogo mestre
    const product = await prisma.produto.findUnique({
      where: {
        codigo_produto_usuario_id: {
          codigo_produto: code,
          usuario_id: MASTER_CATALOG_USER_ID, // Busca sempre no usuário 1
        },
      },
    });

    if (product) {
      return NextResponse.json(product);
    }

    // 3. Se não encontrar de nenhuma forma no catálogo mestre
    return NextResponse.json(
      { error: "Produto não encontrado no catálogo" },
      { status: 404 }
    );
  } catch (error) {
    console.error("Erro ao buscar produto:", error);
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}
