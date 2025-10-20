import type React from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/src/components/ui/card";
import { Button } from "@/src/components/ui/button";
import { CloudUpload, Download, Package, ScanLine } from "lucide-react";
import type { ProductCount } from "@/src/lib/types";

// --- INTERFACE SIMPLIFICADA ---
interface ExportTabProps {
  productCounts: ProductCount[];
  productCountsStats: {
    totalLoja: number;
    totalEstoque: number;
  };
  exportToCsv: () => void;
  handleSaveCount: () => void;
}

export const ExportTab: React.FC<ExportTabProps> = ({
  productCounts,
  productCountsStats,
  exportToCsv,
  handleSaveCount,
}) => {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Package className="h-5 w-5 mr-2" />
            Resumo da Contagem
          </CardTitle>
          <CardDescription>
            Visão geral do progresso da contagem atual
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* --- LAYOUT SIMPLIFICADO PARA 2 COLUNAS --- */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg text-center">
              <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                {productCounts.length}
              </p>
              <p className="text-sm text-green-800 dark:text-green-200">
                Itens Únicos Contados
              </p>
            </div>
            <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg text-center">
              <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                {productCountsStats.totalLoja + productCountsStats.totalEstoque}
              </p>
              <p className="text-sm text-blue-800 dark:text-blue-200">
                Total de Unidades
              </p>
            </div>
            {/* O cartão de "Itens Faltantes" foi removido */}
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Download className="h-5 w-5 mr-2" />
            Ações de Contagem
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex w-full flex-col sm:flex-row items-center gap-2">
            <Button
              onClick={exportToCsv}
              variant="outline"
              className="flex-1 w-full"
            >
              <Download className="mr-2 h-4 w-4" />
              Exportar CSV
            </Button>
            <Button onClick={handleSaveCount} className="flex-1 w-full">
              <CloudUpload className="mr-2 h-4 w-4" />
              Salvar no Histórico
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

ExportTab.displayName = "ExportTab";
