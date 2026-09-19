import * as XLSX from "xlsx";

/**
 * Universal Excel export helper for desktop and web fallback.
 * Uses native Electron save dialog (which opens at the previously used folder),
 * or falls back to XLSX.writeFile in browser mode.
 */
export async function exportToExcel({
  kind,
  data,
  defaultFileName,
  toast,
}) {
  if (!data || data.length === 0) {
    if (toast) toast({ title: "No data to export", description: "There are no records to export.", variant: "destructive" });
    return;
  }

  const fileName = defaultFileName || `${kind.toLowerCase()}_export_${new Date().toISOString().slice(0, 10)}.xlsx`;

  try {
    if (window.api?.excel?.exportData) {
      const result = await window.api.excel.exportData(kind, data, fileName);
      if (result?.cancelled) return;
      if (toast) {
        toast({
          title: "Export Successful",
          description: `Saved ${result?.count ?? data.length} rows to ${result?.path ?? fileName}`,
        });
      }
      return result;
    }

    // Fallback for browser mode
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, kind.slice(0, 31));
    XLSX.writeFile(wb, fileName);
    if (toast) {
      toast({
        title: "Export Successful",
        description: `Exported ${data.length} rows as ${fileName}`,
      });
    }
  } catch (err) {
    if (toast) {
      toast({
        title: "Export Failed",
        description: err.message,
        variant: "destructive",
      });
    }
  }
}
