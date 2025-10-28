// src/hooks/useInventory.ts

import { useState, useEffect, useMemo, useCallback } from "react";
import { toast } from "@/hooks/use-toast";
import * as Papa from "papaparse";
import type { Product, ProductCount } from "@/lib/types";

const loadCountsFromLocalStorage = (userId: number | null): ProductCount[] => {
  if (typeof window === "undefined" || !userId) {
    return [];
  }
  try {
    const savedCounts = localStorage.getItem(`productCounts-${userId}`);
    return savedCounts ? JSON.parse(savedCounts) : [];
  } catch (error) {
    console.error("Falha ao ler contagens do localStorage", error);
    return [];
  }
};

export const useInventory = ({ userId }: { userId: number | null }) => {
  const [scanInput, setScanInput] = useState("");
  const [quantityInput, setQuantityInput] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [currentProduct, setCurrentProduct] = useState<Product | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [countingMode, setCountingMode] = useState<"loja" | "estoque">("loja");
  const [productCounts, setProductCounts] = useState<ProductCount[]>([]);
  const [showClearDataModal, setShowClearDataModal] = useState(false);
  const [isCameraViewActive, setIsCameraViewActive] = useState(false);
  const [history, setHistory] = useState<any[]>([]);

  useEffect(() => {
    setProductCounts(loadCountsFromLocalStorage(userId));
  }, [userId]);

  useEffect(() => {
    if (userId) {
      localStorage.setItem(
        `productCounts-${userId}`,
        JSON.stringify(productCounts)
      );
    }
  }, [productCounts, userId]);

  const handleScan = useCallback(async () => {
    if (scanInput.trim() === "" || !userId) return;

    setIsLoading(true);
    setCurrentProduct(null);

    try {
      const response = await fetch(
        `/api/products/${userId}/${scanInput.trim()}`
      );
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Produto não encontrado");
      }

      setCurrentProduct(data as Product);
      toast({
        title: "Produto Encontrado!",
        description: data.descricao,
      });
    } catch (error: any) {
      setCurrentProduct(null);
      toast({
        title: "Atenção",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [scanInput, userId]);

  const calculateExpression = useCallback(
    (
      expression: string
    ): { result: number; isValid: boolean; error?: string } => {
      try {
        const cleanExpression = expression.replace(/\s/g, "").replace(",", ".");
        if (!/^[0-9+\-*/().]+$/.test(cleanExpression))
          return { result: 0, isValid: false, error: "Caracteres inválidos" };
        const result = new Function("return " + cleanExpression)();
        if (typeof result !== "number" || !isFinite(result))
          return { result: 0, isValid: false, error: "Resultado inválido" };
        return { result: Math.round(result * 100) / 100, isValid: true };
      } catch (error) {
        return { result: 0, isValid: false, error: "Expressão inválida" };
      }
    },
    []
  );

  const handleAddCount = useCallback(() => {
    if (!currentProduct || !quantityInput) return;
    let finalQuantity: number;
    const hasOperators = /[+\-*/]/.test(quantityInput);

    if (hasOperators) {
      const calculation = calculateExpression(quantityInput);
      if (!calculation.isValid) {
        toast({
          title: "Erro no cálculo",
          description: calculation.error,
          variant: "destructive",
        });
        return;
      }
      finalQuantity = calculation.result;
    } else {
      const parsed = parseFloat(quantityInput.replace(",", "."));
      if (isNaN(parsed) || parsed < 0) {
        toast({
          title: "Erro",
          description: "Quantidade inválida",
          variant: "destructive",
        });
        return;
      }
      finalQuantity = parsed;
    }

    setProductCounts((prevCounts) => {
      const existingIndex = prevCounts.findIndex(
        (item) =>
          item.codigo_produto === currentProduct.codigo_produto &&
          item.data_validade === (expiryDate || null) // <-- MODIFICADO
      );
      if (existingIndex >= 0) {
        const updatedCounts = [...prevCounts];
        const existingItem = { ...updatedCounts[existingIndex] };
        if (countingMode === "loja") existingItem.quant_loja += finalQuantity;
        else existingItem.quant_estoque += finalQuantity;

        updatedCounts[existingIndex] = existingItem;
        return updatedCounts;
      } else {
        const newCount: ProductCount = {
          id: Date.now(),
          codigo_de_barras: scanInput,
          codigo_produto: currentProduct.codigo_produto,
          descricao: currentProduct.descricao,
          quant_loja: countingMode === "loja" ? finalQuantity : 0,
          quant_estoque: countingMode === "estoque" ? finalQuantity : 0,
          data_validade: expiryDate || null,
          local_estoque: "",
          data_hora: new Date().toISOString(),
        };
        return [...prevCounts, newCount];
      }
    });

    toast({ title: "Contagem adicionada!" });
    setScanInput("");
    setQuantityInput("");
    setExpiryDate("");
    setCurrentProduct(null);
  }, [
    currentProduct,
    quantityInput,
    countingMode,
    expiryDate,
    scanInput,
    calculateExpression,
  ]);

  const handleClearAllData = useCallback(async () => {
    if (!userId) return;
    setProductCounts([]);
    localStorage.removeItem(`productCounts-${userId}`);
    setShowClearDataModal(false);
    toast({
      title: "Sucesso!",
      description: "A contagem atual foi limpa.",
    });
  }, [userId]);

  const handleRemoveCount = useCallback((id: number) => {
    setProductCounts((prev) => prev.filter((item) => item.id !== id));
    toast({ title: "Item removido da contagem" });
  }, []);

  const handleBarcodeScanned = useCallback((barcode: string) => {
    setIsCameraViewActive(false);
    setScanInput(barcode);
    setTimeout(() => {
      document.getElementById("scan-button")?.click();
    }, 100);
  }, []);

  const handleQuantityKeyPress = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") {
        e.preventDefault();
        handleAddCount();
      }
    },
    [handleAddCount]
  );

  const productCountsStats = useMemo(() => {
    return productCounts.reduce(
      (acc, item) => {
        acc.totalLoja += item.quant_loja;
        acc.totalEstoque += item.quant_estoque;
        return acc;
      },
      { totalLoja: 0, totalEstoque: 0 }
    );
  }, [productCounts]);

  const loadHistory = useCallback(async () => {
    if (!userId) return;
    try {
      const response = await fetch(`/api/inventory/${userId}/history`);
      if (!response.ok) throw new Error("Falha ao carregar o histórico.");
      const data = await response.json();
      setHistory(data);
    } catch (error: any) {
      toast({
        title: "Erro ao carregar histórico",
        description: error.message,
        variant: "destructive",
      });
    }
  }, [userId]);

  const handleDeleteHistoryItem = useCallback(
    async (historyId: number) => {
      if (!userId) return;
      try {
        const response = await fetch(
          `/api/inventory/${userId}/history/${historyId}`,
          { method: "DELETE" }
        );
        if (!response.ok)
          throw new Error("Falha ao excluir o item do histórico.");
        setHistory((prev) => prev.filter((item) => item.id !== historyId));
        toast({
          title: "Sucesso!",
          description: "O item foi removido do histórico.",
        });
      } catch (error: any) {
        toast({
          title: "Erro ao excluir",
          description: error.message,
          variant: "destructive",
        });
      }
    },
    [userId]
  );

  const generateReportData = useCallback(() => {
    return productCounts.map((item) => ({
      codigo_de_barras: item.codigo_de_barras,
      codigo_produto: item.codigo_produto,
      descricao: item.descricao,
      quant_loja: item.quant_loja,
      quant_estoque: item.quant_estoque,
      data_validade: item.data_validade || "",
    }));
  }, [productCounts]);

  const exportToCsv = useCallback(() => {
    if (productCounts.length === 0) {
      toast({
        title: "Nenhum item para exportar",
        description: "Comece a contar primeiro.",
        variant: "destructive",
      });
      return;
    }
    const dataToExport = generateReportData();
    const csv = Papa.unparse(dataToExport, {
      header: true,
      delimiter: ";",
      quotes: true,
    });
    const blob = new Blob([`\uFEFF${csv}`], {
      type: "text/csv;charset=utf-8;",
    });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `contagem_${new Date().toISOString().split("T")[0]}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  }, [productCounts, generateReportData]);

  const handleSaveCount = useCallback(async () => {
    if (!userId || productCounts.length === 0) {
      toast({
        title: "Nada para salvar",
        description: "Não há itens na contagem atual.",
        variant: "destructive",
      });
      return;
    }
    const dataToExport = generateReportData();
    const csvContent = Papa.unparse(dataToExport, {
      header: true,
      delimiter: ";",
      quotes: true,
    });
    const fileName = `contagem_${new Date().toISOString().split("T")[0]}.csv`;

    try {
      const response = await fetch(`/api/inventory/${userId}/history`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileName, csvContent }),
      });
      if (!response.ok)
        throw new Error("Falha ao salvar a contagem no servidor.");
      toast({
        title: "Sucesso!",
        description: "Sua contagem foi salva no histórico.",
      });
    } catch (error: any) {
      toast({
        title: "Erro ao salvar",
        description: error.message,
        variant: "destructive",
      });
    }
  }, [userId, productCounts, generateReportData]);

  return {
    scanInput,
    setScanInput,
    quantityInput,
    setQuantityInput,
    currentProduct,
    isLoading,
    countingMode,
    setCountingMode,
    productCounts,
    showClearDataModal,
    expiryDate,
    setExpiryDate,
    setShowClearDataModal,
    isCameraViewActive,
    setIsCameraViewActive,
    productCountsStats,
    handleClearAllData,
    handleScan,
    handleBarcodeScanned,
    handleAddCount,
    handleQuantityKeyPress,
    handleRemoveCount,
    exportToCsv,
    history,
    loadHistory,
    handleSaveCount,
    handleDeleteHistoryItem,
  };
};
