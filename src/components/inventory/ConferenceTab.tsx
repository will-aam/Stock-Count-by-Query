// src/components/inventory/ConferenceTab.tsx

import type React from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  CloudUpload,
  Scan,
  Store,
  Package,
  Camera,
  Plus,
  Trash2,
  Loader2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { Product, ProductCount } from "@/lib/types";
import { BarcodeScanner } from "@/components/features/barcode-scanner";

interface ConferenceTabProps {
  isLoading: boolean;
  countingMode: "loja" | "estoque";
  setCountingMode: (mode: "loja" | "estoque") => void;
  scanInput: string;
  setScanInput: (value: string) => void;
  handleScan: () => void;
  isCameraViewActive: boolean;
  setIsCameraViewActive: (show: boolean) => void;
  handleBarcodeScanned: (barcode: string) => void;
  currentProduct: Product | null;
  quantityInput: string;
  setQuantityInput: (value: string) => void;
  expiryDate: string; // <-- ADICIONE ESTA LINHA
  setExpiryDate: (value: string) => void; // <-- ADICIONE ESTA LINHA
  handleQuantityKeyPress: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  handleAddCount: () => void;
  productCounts: ProductCount[];
  handleRemoveCount: (id: number) => void;
  handleSaveCount: () => void;
}

// --- COMPONENTE VISUAL SIMPLIFICADO ---
const ProductCountItem = ({
  item,
  onRemove,
}: {
  item: ProductCount;
  onRemove: (id: number) => void;
}) => (
  <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
    <div className="flex-1">
      <p className="font-medium text-sm">{item.descricao}</p>
      <p className="text-xs text-gray-600 dark:text-gray-400">
        Cód. Barras: {item.codigo_de_barras}
      </p>
      <div className="flex items-center space-x-2 mt-1">
        <Badge variant="outline" className="text-xs">
          Loja: {item.quant_loja}
        </Badge>
        <Badge variant="outline" className="text-xs">
          Estoque: {item.quant_estoque}
        </Badge>
        {/* --- BLOCO MODIFICADO/ADICIONADO --- */}
        {item.data_validade && (
          <Badge variant="secondary" className="text-xs">
            Val:{" "}
            {new Date(item.data_validade + "T00:00:00").toLocaleDateString(
              "pt-BR",
              {
                timeZone: "UTC",
              }
            )}
          </Badge>
        )}
        {/* --- FIM DO BLOCO --- */}
      </div>
    </div>
    <Button variant="outline" size="sm" onClick={() => onRemove(item.id)}>
      <Trash2 className="h-4 w-4" />
    </Button>
  </div>
);
ProductCountItem.displayName = "ProductCountItem";

export const ConferenceTab: React.FC<ConferenceTabProps> = ({
  isLoading,
  countingMode,
  setCountingMode,
  scanInput,
  setScanInput,
  handleScan,
  isCameraViewActive,
  setIsCameraViewActive,
  handleBarcodeScanned,
  currentProduct,
  quantityInput,
  setQuantityInput,
  expiryDate, // <-- ADICIONADO
  setExpiryDate, // <-- ADICIONADO
  handleQuantityKeyPress,
  handleAddCount,
  productCounts,
  handleRemoveCount,
  handleSaveCount,
}) => {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Scan className="h-5 w-5 mr-2" /> Scanner de Código de Barras
          </CardTitle>
          <CardDescription>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  onClick={handleSaveCount}
                  variant="outline"
                  className="flex-grow sm:flex-grow-0"
                >
                  <CloudUpload className="mr-2 h-4 w-4" />
                  Salvar Contagem
                </Button>

                <div className="flex flex-1 space-x-2 min-w-[200px]">
                  <Button
                    variant={countingMode === "loja" ? "default" : "outline"}
                    className="w-1/2"
                    onClick={() => setCountingMode("loja")}
                  >
                    <Store className="h-4 w-4 mr-2" /> Loja
                  </Button>
                  <Button
                    variant={countingMode === "estoque" ? "default" : "outline"}
                    className="w-1/2"
                    onClick={() => setCountingMode("estoque")}
                  >
                    <Package className="h-4 w-4 mr-2" /> Estoque
                  </Button>
                </div>
              </div>
            </div>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {isCameraViewActive ? (
            <BarcodeScanner
              onScan={handleBarcodeScanned}
              onClose={() => setIsCameraViewActive(false)}
            />
          ) : (
            <>
              <div className="space-y-2">
                <Label htmlFor="barcode">Código de Barras ou Interno</Label>
                <div className="flex space-x-2">
                  <Input
                    id="barcode"
                    value={scanInput}
                    onChange={(e) => setScanInput(e.target.value)}
                    placeholder="Digite ou escaneie o código"
                    className="flex-1 mobile-optimized"
                    onKeyPress={(e) => e.key === "Enter" && handleScan()}
                    disabled={isLoading}
                  />
                  <Button
                    onClick={handleScan}
                    disabled={isLoading}
                    id="scan-button"
                  >
                    {isLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Scan className="h-4 w-4" />
                    )}
                  </Button>
                  <Button
                    onClick={() => setIsCameraViewActive(true)}
                    variant="outline"
                    disabled={isLoading}
                  >
                    <Camera className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              {currentProduct && (
                <div className="p-4 border rounded-lg bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="font-semibold text-green-800 dark:text-green-200">
                        Produto Encontrado
                      </h3>
                      <p className="text-sm text-green-700 dark:text-green-300">
                        {currentProduct.descricao}
                      </p>
                      <p className="text-xs text-green-600 dark:text-green-400">
                        Cód. Interno: {currentProduct.codigo_produto}
                      </p>
                    </div>
                    {/* Badge de saldo de estoque removido */}
                  </div>
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="quantity">
                  Quantidade{" "}
                  {countingMode === "loja" ? "em Loja" : "em Estoque"}
                </Label>
                <Input
                  id="quantity"
                  type="text"
                  inputMode="decimal"
                  value={quantityInput}
                  onChange={(e) => setQuantityInput(e.target.value)}
                  onKeyPress={handleQuantityKeyPress}
                  placeholder="Qtd ou expressão (ex: 24+24)"
                  className="mobile-optimized font-mono"
                  disabled={!currentProduct}
                />
              </div>
              {/* --- BLOCO NOVO PARA DATA DE VALIDADE --- */}
              <div className="space-y-2">
                <Label htmlFor="expiry-date">Data de Validade (Opcional)</Label>
                <Input
                  id="expiry-date"
                  type="date"
                  value={expiryDate}
                  onChange={(e) => setExpiryDate(e.target.value)}
                  onKeyPress={handleQuantityKeyPress}
                  className="mobile-optimized"
                  disabled={!currentProduct}
                />
              </div>
              {/* --- FIM DO BLOCO --- */}
              <Button
                onClick={handleAddCount}
                className="w-full mobile-button"
                disabled={!currentProduct || !quantityInput}
              >
                <Plus className="h-4 w-4 mr-2" />
                Adicionar Contagem
              </Button>
            </>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Produtos Contados ({productCounts.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {productCounts.length === 0 ? (
              <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p className="font-medium">Nenhum produto contado ainda</p>
                <p className="text-sm">Escaneie um código para começar</p>
              </div>
            ) : (
              [...productCounts]
                .reverse()
                .map((item) => (
                  <ProductCountItem
                    key={item.id}
                    item={item}
                    onRemove={handleRemoveCount}
                  />
                ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
ConferenceTab.displayName = "ConferenceTab";
