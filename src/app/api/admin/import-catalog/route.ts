import { NextResponse } from "next/server";
import { prisma } from "@/src/lib/prisma";
import * as Papa from "papaparse";

// O ID do usuário que é o "dono" do catálogo mestre.
const MASTER_CATALOG_USER_ID = 1;

interface CsvRow {
  cod_item: string;
  cod_barra: string;
  des_item: string;
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json(
        { error: "Nenhum arquivo enviado" },
        { status: 400 }
      );
    }

    const csvText = await file.text();
    const parseResult = Papa.parse<CsvRow>(csvText, {
      header: true,
      delimiter: ";",
      skipEmptyLines: true,
    });

    if (parseResult.errors.length > 0) {
      return NextResponse.json(
        { error: "Erro ao analisar o CSV", details: parseResult.errors },
        { status: 400 }
      );
    }

    let importados = 0;
    for (const row of parseResult.data) {
      if (!row.cod_item || !row.cod_barra || !row.des_item) {
        console.warn("Linha do CSV ignorada por ter dados faltando:", row);
        continue;
      }

      await prisma.$transaction(
        async (tx: {
          produto: {
            upsert: (arg0: {
              where: {
                codigo_produto_usuario_id: {
                  codigo_produto: string;
                  usuario_id: number;
                };
              };
              update: { descricao: string };
              create: {
                codigo_produto: string;
                descricao: string;
                usuario_id: number;
              };
            }) => any;
          };
          codigoBarras: {
            upsert: (arg0: {
              where: {
                codigo_de_barras_usuario_id: {
                  codigo_de_barras: string;
                  usuario_id: number;
                };
              };
              update: { produto_id: any };
              create: {
                codigo_de_barras: string;
                produto_id: any;
                usuario_id: number;
              };
            }) => any;
          };
        }) => {
          const produto = await tx.produto.upsert({
            where: {
              codigo_produto_usuario_id: {
                codigo_produto: row.cod_item,
                usuario_id: MASTER_CATALOG_USER_ID,
              },
            },
            update: {
              descricao: row.des_item,
            },
            create: {
              codigo_produto: row.cod_item,
              descricao: row.des_item,
              usuario_id: MASTER_CATALOG_USER_ID,
            },
          });

          await tx.codigoBarras.upsert({
            where: {
              codigo_de_barras_usuario_id: {
                codigo_de_barras: row.cod_barra,
                usuario_id: MASTER_CATALOG_USER_ID,
              },
            },
            update: {
              produto_id: produto.id,
            },
            create: {
              codigo_de_barras: row.cod_barra,
              produto_id: produto.id,
              usuario_id: MASTER_CATALOG_USER_ID,
            },
          });
        }
      );
      importados++;
    }

    return NextResponse.json({
      success: true,
      message: `${importados} produtos foram importados/atualizados no catálogo mestre.`,
    });
  } catch (error) {
    console.error("Erro na importação do catálogo mestre:", error);
    return NextResponse.json(
      { error: "Erro interno do servidor." },
      { status: 500 }
    );
  }
}
