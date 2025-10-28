// src/app/api/inventory/[userId]/count/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(
  request: Request,
  { params }: { params: { userId: string } }
) {
  try {
    const userId = parseInt(params.userId, 10);
    if (isNaN(userId)) {
      return NextResponse.json(
        { error: "ID de usuário inválido" },
        { status: 400 }
      );
    }

    const body = await request.json();
    // Extrai expiryDate do corpo da requisição
    const { product, quantity, countingMode, expiryDate } = body;

    // Valida se a data de validade é uma string ou nula/undefined
    if (
      !product ||
      typeof quantity !== "number" ||
      !countingMode ||
      (expiryDate && typeof expiryDate !== "string")
    ) {
      return NextResponse.json(
        { error: "Dados da requisição incompletos ou inválidos" },
        { status: 400 }
      );
    }

    // Converte a string de data (YYYY-MM-DD) para um objeto Date UTC ou null
    let dataValidade = null;
    if (expiryDate) {
      const dateParts = expiryDate.split("-");
      if (dateParts.length === 3) {
        // Cria a data em UTC para evitar problemas de fuso horário
        dataValidade = new Date(
          Date.UTC(
            parseInt(dateParts[0]),
            parseInt(dateParts[1]) - 1, // Mês é 0-indexado
            parseInt(dateParts[2])
          )
        );
        // Verifica se a data é válida
        if (isNaN(dataValidade.getTime())) {
          return NextResponse.json(
            { error: "Data de validade inválida" },
            { status: 400 }
          );
        }
      } else {
        return NextResponse.json(
          {
            error: "Formato da data de validade inválido (esperado YYYY-MM-DD)",
          },
          { status: 400 }
        );
      }
    }

    // --- LÓGICA ATUALIZADA ---

    // 1. Encontra ou cria a sessão de contagem ativa
    let contagem = await prisma.contagem.findFirst({
      where: { usuario_id: userId, status: "em_andamento" },
    });
    if (!contagem) {
      contagem = await prisma.contagem.create({
        data: { usuario_id: userId, status: "em_andamento" },
      });
    }

    // 2. Garante que o produto exista (usando o catálogo mestre como referência, se aplicável, ou o próprio do usuário)
    //    A lógica de encontrar o produto deve vir da API /api/products/[userId]/[code]/route.ts
    //    Aqui, assumimos que o 'product' enviado já foi validado e contém o ID correto.
    //    Se o produto não existir por algum motivo (deveria existir pela busca anterior), um erro ocorrerá.
    //    Não precisamos mais fazer upsert do produto aqui, apenas referenciar seu ID.
    const produtoId = product.id; // Assume que o frontend envia o ID do produto encontrado

    if (!produtoId) {
      return NextResponse.json(
        { error: "ID do produto não fornecido na requisição" },
        { status: 400 }
      );
    }

    // 3. Procura por um item já contado para este produto E data de validade nesta contagem
    //    Usa o índice @@unique([contagem_id, produto_id, data_validade])

    // CORREÇÃO: Busca ajustada para lidar com dataValidade nula
    const itemContadoExistente = await prisma.itemContado.findFirst({
      where: {
        contagem_id: contagem.id,
        produto_id: produtoId,
        data_validade: dataValidade, // Passa Date ou null aqui diretamente
      },
    });

    let itemAtualizado;

    if (itemContadoExistente) {
      // Se JÁ EXISTE: calcula as novas quantidades e atualiza
      const novaQuantLoja =
        itemContadoExistente.quant_loja +
        (countingMode === "loja" ? quantity : 0);
      const novaQuantEstoque =
        itemContadoExistente.quant_estoque +
        (countingMode === "estoque" ? quantity : 0);

      itemAtualizado = await prisma.itemContado.update({
        where: {
          // Usamos o ID do item existente para garantir a atualização correta
          id: itemContadoExistente.id,
        },
        data: {
          quant_loja: novaQuantLoja,
          quant_estoque: novaQuantEstoque,
          // Removemos 'total' e 'saldo_estoque_inicial' daqui
        },
      });
    } else {
      // Se NÃO EXISTE: cria o registro pela primeira vez
      itemAtualizado = await prisma.itemContado.create({
        data: {
          contagem_id: contagem.id,
          produto_id: produtoId,
          quant_loja: countingMode === "loja" ? quantity : 0,
          quant_estoque: countingMode === "estoque" ? quantity : 0,
          data_validade: dataValidade, // Salva a data convertida (pode ser null)
          // Removemos 'codigo_de_barras', 'saldo_estoque_inicial' e 'total' daqui
        },
      });
    }

    // Retorna o item criado ou atualizado, incluindo a data de validade
    const itemComProduto = await prisma.itemContado.findUnique({
      where: { id: itemAtualizado.id },
      include: { produto: true }, // Inclui dados do produto na resposta
    });

    return NextResponse.json(itemComProduto); // Retorna o item com dados do produto
  } catch (error: any) {
    console.error("Erro CRÍTICO ao salvar contagem:", error);
    // Verifica se é um erro de constraint única (produto + validade já existe)
    if (error.code === "P2002") {
      // Código de erro do Prisma para unique constraint violation
      return NextResponse.json(
        {
          error:
            "Erro interno: Tentativa de duplicar item contado (produto + validade). Isso não deveria acontecer com a lógica atual.",
        },
        { status: 409 } // Conflict
      );
    }
    return NextResponse.json(
      {
        error: "Erro interno do servidor. Verifique os logs.",
        details: error.message,
      },
      { status: 500 }
    );
  }
}

// --- ADICIONAR FUNÇÃO GET PARA CARREGAR CONTAGEM ---
export async function GET(
  request: Request,
  { params }: { params: { userId: string } }
) {
  try {
    const userId = parseInt(params.userId, 10);
    if (isNaN(userId)) {
      return NextResponse.json(
        { error: "ID de usuário inválido" },
        { status: 400 }
      );
    }

    // Encontra a contagem ativa do usuário
    const contagemAtiva = await prisma.contagem.findFirst({
      where: {
        usuario_id: userId,
        status: "em_andamento",
      },
      include: {
        // Inclui os itens contados E os dados dos produtos relacionados
        itens: {
          include: {
            produto: true,
          },
          orderBy: {
            updated_at: "desc", // Ordena pelos mais recentes primeiro
          },
        },
      },
    });

    // Se não houver contagem ativa, retorna uma lista vazia de itens
    if (!contagemAtiva) {
      return NextResponse.json([]);
    }

    // Mapeia os itens para o formato esperado pelo frontend (similar ao ProductCount)
    const itensFormatados = contagemAtiva.itens.map((item) => ({
      id: item.id, // Usar o ID real do ItemContado
      codigo_de_barras: "", // O código de barras não está salvo em ItemContado, pode precisar buscar se necessário
      codigo_produto: item.produto.codigo_produto,
      descricao: item.produto.descricao,
      quant_loja: item.quant_loja,
      quant_estoque: item.quant_estoque,
      // Formata a data de volta para YYYY-MM-DD ou null
      data_validade: item.data_validade
        ? item.data_validade.toISOString().split("T")[0]
        : null,
      local_estoque: "", // Este campo não está no DB, manter vazio por enquanto
      data_hora: item.updated_at.toISOString(), // Usar updated_at como referência
    }));

    return NextResponse.json(itensFormatados);
  } catch (error) {
    console.error("Erro ao buscar contagem ativa:", error);
    return NextResponse.json(
      { error: "Erro interno do servidor ao buscar contagem" },
      { status: 500 }
    );
  }
}

// --- ADICIONAR FUNÇÃO DELETE PARA REMOVER ITEM ---
export async function DELETE(
  request: Request,
  { params }: { params: { userId: string } }
) {
  try {
    const userId = parseInt(params.userId, 10);
    if (isNaN(userId)) {
      return NextResponse.json(
        { error: "ID de usuário inválido" },
        { status: 400 }
      );
    }

    const { itemId } = await request.json(); // Espera receber o ID do item a ser deletado

    if (!itemId || typeof itemId !== "number") {
      return NextResponse.json(
        { error: "ID do item contado inválido ou não fornecido" },
        { status: 400 }
      );
    }

    // Verifica se o item pertence à contagem ativa do usuário antes de deletar
    const contagemAtiva = await prisma.contagem.findFirst({
      where: { usuario_id: userId, status: "em_andamento" },
      select: { id: true }, // Seleciona apenas o ID da contagem
    });

    if (!contagemAtiva) {
      return NextResponse.json(
        { error: "Nenhuma contagem ativa encontrada para este usuário" },
        { status: 404 }
      );
    }

    // Tenta deletar o item usando o ID e verificando se pertence à contagem ativa
    const deleteResult = await prisma.itemContado.deleteMany({
      where: {
        id: itemId,
        contagem_id: contagemAtiva.id, // Garante que só delete itens da contagem ativa do usuário logado
      },
    });

    // Verifica se algum item foi realmente deletado
    if (deleteResult.count === 0) {
      return NextResponse.json(
        {
          error:
            "Item contado não encontrado ou não pertence à sua contagem ativa",
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Item removido com sucesso",
    });
  } catch (error) {
    console.error("Erro ao remover item contado:", error);
    return NextResponse.json(
      { error: "Erro interno do servidor ao remover item" },
      { status: 500 }
    );
  }
}
