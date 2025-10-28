// src/hooks/useInventory.ts

import { useState, useEffect, useMemo, useCallback } from "react";
import { toast } from "@/hooks/use-toast";
import * as Papa from "papaparse";
import type { Product, ProductCount } from "@/lib/types"; // Make sure ProductCount includes data_validade

export const useInventory = ({ userId }: { userId: number | null }) => {
  const [scanInput, setScanInput] = useState("");
  const [quantityInput, setQuantityInput] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [currentProduct, setCurrentProduct] = useState<Product | null>(null);
  const [isLoadingProduct, setIsLoadingProduct] = useState(false); // Loading for product scan
  const [isSubmitting, setIsSubmitting] = useState(false); // Loading for add/remove count
  const [isLoadingCount, setIsLoadingCount] = useState(true); // Loading initial count
  const [countingMode, setCountingMode] = useState<"loja" | "estoque">("loja");
  const [productCounts, setProductCounts] = useState<ProductCount[]>([]);
  const [showClearDataModal, setShowClearDataModal] = useState(false);
  const [isCameraViewActive, setIsCameraViewActive] = useState(false);
  const [history, setHistory] = useState<any[]>([]);

  // Function to load the active count from the DB
  const loadActiveCount = useCallback(async () => {
    if (!userId) {
      setProductCounts([]);
      setIsLoadingCount(false);
      return;
    }
    setIsLoadingCount(true);
    try {
      const response = await fetch(`/api/inventory/${userId}/count`);
      if (!response.ok) {
        throw new Error("Falha ao carregar contagem ativa do servidor.");
      }
      const data: ProductCount[] = await response.json();
      // Ensure data_validade is null if empty string or undefined from API
      const formattedData = data.map((item) => ({
        ...item,
        data_validade: item.data_validade || null,
      }));
      setProductCounts(formattedData);
    } catch (error: any) {
      toast({
        title: "Erro ao carregar contagem",
        description: error.message,
        variant: "destructive",
      });
      setProductCounts([]); // Clear local state on error
    } finally {
      setIsLoadingCount(false);
    }
  }, [userId]);

  // Load active count on initial mount or when userId changes
  useEffect(() => {
    loadActiveCount();
  }, [userId, loadActiveCount]);

  // Handle product scanning (unchanged, but uses setIsLoadingProduct)
  const handleScan = useCallback(async () => {
    if (scanInput.trim() === "" || !userId) return;

    setIsLoadingProduct(true);
    setCurrentProduct(null);

    try {
      const response = await fetch(
        `/api/products/${userId}/${scanInput.trim()}`
      );
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Produto não encontrado");
      }

      setCurrentProduct(data as Product); // API returns Product type
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
      setIsLoadingProduct(false);
    }
  }, [scanInput, userId]);

  // Calculate expression (unchanged)
  const calculateExpression = useCallback(
    /* ... (keep existing code) ... */
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

  // Handle adding/updating count via API POST request
  const handleAddCount = useCallback(async () => {
    if (!currentProduct || !quantityInput || !userId || isSubmitting) return;

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

    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/inventory/${userId}/count`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          product: currentProduct, // Send the whole product object found
          quantity: finalQuantity,
          countingMode: countingMode,
          expiryDate: expiryDate || null, // Send null if empty
        }),
      });

      const savedItem = await response.json();

      if (!response.ok) {
        throw new Error(
          savedItem.error || "Falha ao salvar contagem no servidor."
        );
      }

      // Update state: Remove old entry (if exists) and prepend the new/updated one
      setProductCounts((prevCounts) => {
        const updatedItemFromServer: ProductCount = {
          id: savedItem.id,
          codigo_de_barras: scanInput, // Use the scanned code
          codigo_produto: savedItem.produto.codigo_produto,
          descricao: savedItem.produto.descricao,
          quant_loja: savedItem.quant_loja,
          quant_estoque: savedItem.quant_estoque,
          data_validade: savedItem.data_validade
            ? savedItem.data_validade.split("T")[0]
            : null,
          local_estoque: "", // Keep consistent with existing structure
          data_hora: savedItem.updated_at,
        };
        // Filter out the item if it was already in the list (updated case)
        const filteredList = prevCounts.filter(
          (item) => item.id !== savedItem.id
        );
        // Add the new/updated item to the beginning
        return [updatedItemFromServer, ...filteredList];
      });

      toast({ title: "Contagem salva!" });
      // Clear inputs after successful save
      setScanInput("");
      setQuantityInput("");
      setExpiryDate("");
      setCurrentProduct(null);
    } catch (error: any) {
      toast({
        title: "Erro ao salvar contagem",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  }, [
    currentProduct,
    quantityInput,
    countingMode,
    expiryDate,
    userId,
    calculateExpression,
    isSubmitting,
    scanInput, // Added scanInput dependency for the saved item structure
  ]);

  // Handle removing count via API DELETE request
  const handleRemoveCount = useCallback(
    async (itemId: number) => {
      if (!userId || isSubmitting) return;

      // Optimistic update: remove immediately from UI
      const originalCounts = [...productCounts];
      setProductCounts((prev) => prev.filter((item) => item.id !== itemId));
      setIsSubmitting(true);

      try {
        const response = await fetch(`/api/inventory/${userId}/count`, {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ itemId }), // Send the ID of the ItemContado
        });

        const result = await response.json();

        if (!response.ok) {
          // Revert optimistic update on failure
          setProductCounts(originalCounts);
          throw new Error(result.error || "Falha ao remover item do servidor.");
        }

        toast({ title: "Item removido com sucesso!" });
      } catch (error: any) {
        // Revert optimistic update on failure
        setProductCounts(originalCounts);
        toast({
          title: "Erro ao remover item",
          description: error.message,
          variant: "destructive",
        });
      } finally {
        setIsSubmitting(false);
      }
    },
    [userId, productCounts, isSubmitting]
  ); // Added productCounts and isSubmitting

  // TODO: Implement API call for clearing data if needed
  const handleClearAllData = useCallback(async () => {
    if (!userId) return;
    // For now, just clears local state. Need API endpoint DELETE /api/inventory/[userId]/count/clear
    console.warn(
      "handleClearAllData only clears local state currently. API endpoint needed."
    );
    setProductCounts([]);
    // localStorage.removeItem(`productCounts-${userId}`); // No longer using localStorage
    setShowClearDataModal(false);
    toast({
      title: "Sucesso!",
      description: "A contagem atual (local) foi limpa.",
    });
    /*
     // Example of future API call:
     setIsSubmitting(true);
     try {
       const response = await fetch(`/api/inventory/${userId}/count/clear`, { method: 'DELETE' });
       if (!response.ok) throw new Error('Failed to clear count on server');
       setProductCounts([]);
       toast({ title: "Sucesso!", description: "Contagem atual limpa no servidor." });
     } catch (error: any) {
       toast({ title: "Erro ao limpar contagem", description: error.message, variant: "destructive" });
     } finally {
       setIsSubmitting(false);
       setShowClearDataModal(false);
     }
     */
  }, [userId]);

  // Barcode scanned from camera (unchanged)
  const handleBarcodeScanned = useCallback(
    /* ... (keep existing code) ... */
    (barcode: string) => {
      setIsCameraViewActive(false);
      setScanInput(barcode);
      setTimeout(() => {
        document.getElementById("scan-button")?.click();
      }, 100);
    },
    []
  );

  // Handle Enter key on quantity/expiry inputs (unchanged)
  const handleQuantityKeyPress = useCallback(
    /* ... (keep existing code) ... */
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") {
        e.preventDefault();
        handleAddCount();
      }
    },
    [handleAddCount]
  );

  // Calculate stats (unchanged)
  const productCountsStats = useMemo(
    /* ... (keep existing code) ... */
    () => {
      return productCounts.reduce(
        (acc, item) => {
          acc.totalLoja += item.quant_loja;
          acc.totalEstoque += item.quant_estoque;
          return acc;
        },
        { totalLoja: 0, totalEstoque: 0 }
      );
    },
    [productCounts]
  );

  // Load history (unchanged)
  const loadHistory = useCallback(
    /* ... (keep existing code) ... */
    async () => {
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
    },
    [userId]
  );

  // Delete history item (unchanged)
  const handleDeleteHistoryItem = useCallback(
    /* ... (keep existing code) ... */
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

  // Generate report data (unchanged, already includes data_validade)
  const generateReportData = useCallback(
    /* ... (keep existing code) ... */
    () => {
      return productCounts.map((item) => ({
        // Use codigo_barras from the item if available, otherwise maybe fetch? For now, keep as is.
        codigo_de_barras: item.codigo_de_barras || "", // Ensure it exists
        codigo_produto: item.codigo_produto,
        descricao: item.descricao,
        quant_loja: item.quant_loja,
        quant_estoque: item.quant_estoque,
        data_validade: item.data_validade || "",
      }));
    },
    [productCounts]
  );

  // Export CSV (unchanged)
  const exportToCsv = useCallback(
    /* ... (keep existing code) ... */
    () => {
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
    },
    [productCounts, generateReportData]
  );

  // Save count to history (unchanged)
  const handleSaveCount = useCallback(
    /* ... (keep existing code) ... */
    async () => {
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

      setIsSubmitting(true); // Add loading state
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
        // Optionally clear the current count after saving to history
        // await handleClearAllData(); // Uncomment if you want to clear after saving
      } catch (error: any) {
        toast({
          title: "Erro ao salvar",
          description: error.message,
          variant: "destructive",
        });
      } finally {
        setIsSubmitting(false); // Remove loading state
      }
    },
    [userId, productCounts, generateReportData /*, handleClearAllData */]
  ); // Added handleClearAllData if uncommented

  return {
    scanInput,
    setScanInput,
    quantityInput,
    setQuantityInput,
    currentProduct,
    isLoading: isLoadingProduct || isLoadingCount, // Combine loading states
    isSubmitting, // Expose submitting state
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
