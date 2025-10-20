"use client";

import { useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/src/components/ui/card";
import { Button } from "@/src/components/ui/button";
import { Input } from "@/src/components/ui/input";
import { Label } from "@/src/components/ui/label";
import { Upload, Loader2, CheckCircle, AlertCircle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/src/components/ui/alert";
import Link from "next/link";

export default function ImportMasterCatalogPage() {
  const [file, setFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<{
    success: boolean;
    message: string;
  } | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFile(e.target.files[0]);
      setUploadStatus(null); // Limpa o status anterior ao selecionar novo arquivo
    }
  };

  const handleSubmit = async () => {
    if (!file) {
      setUploadStatus({
        success: false,
        message: "Por favor, selecione um arquivo.",
      });
      return;
    }

    setIsLoading(true);
    setUploadStatus(null);
    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await fetch("/api/admin/import-catalog", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Ocorreu um erro desconhecido.");
      }

      setUploadStatus({ success: true, message: data.message });
    } catch (error: any) {
      setUploadStatus({ success: false, message: error.message });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-muted/40 p-4">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <CardTitle className="flex items-center">
            <Upload className="h-5 w-5 mr-2" />
            Importar Catálogo Mestre
          </CardTitle>
          <CardDescription>
            Faça o upload do seu arquivo CSV de produtos. Isso substituirá ou
            atualizará os itens existentes.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="csv-file">Arquivo CSV</Label>
            <Input
              id="csv-file"
              type="file"
              accept=".csv"
              onChange={handleFileChange}
              disabled={isLoading}
            />
            <p className="text-xs text-muted-foreground">
              Colunas esperadas: <strong>cod_item, cod_barra, des_item</strong>{" "}
              (separadas por ponto e vírgula).
            </p>
          </div>

          {uploadStatus && (
            <Alert variant={uploadStatus.success ? "default" : "destructive"}>
              {uploadStatus.success ? (
                <CheckCircle className="h-4 w-4" />
              ) : (
                <AlertCircle className="h-4 w-4" />
              )}
              <AlertTitle>
                {uploadStatus.success ? "Sucesso!" : "Erro!"}
              </AlertTitle>
              <AlertDescription>{uploadStatus.message}</AlertDescription>
            </Alert>
          )}

          <Button
            onClick={handleSubmit}
            className="w-full"
            disabled={isLoading}
          >
            {isLoading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Upload className="mr-2 h-4 w-4" />
            )}
            {isLoading ? "Importando..." : "Enviar Arquivo"}
          </Button>

          <Button variant="outline" className="w-full" asChild>
            <Link href="/">Voltar para a Contagem</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
