"use client";
import { useEffect, useState } from "react";
import { useCompany, api } from "@/components/company-context";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { format } from "date-fns";

export default function AuditLogPage() {
  const { active } = useCompany();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (active) loadLogs();
  }, [active]);

  async function loadLogs() {
    try {
      setLoading(true);
      const data = await api("/api/reports/audit");
      setLogs(data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  if (!active) return <div className="p-10 text-center">Select a company to view logs.</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Audit Log (Edit History)</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent Changes</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="py-10 text-center">Loading logs...</div>
          ) : logs.length === 0 ? (
            <div className="py-10 text-center text-muted-foreground">No logs found.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="border-b bg-muted/50">
                  <tr>
                    <th className="p-3 font-medium">Timestamp</th>
                    <th className="p-3 font-medium">Table</th>
                    <th className="p-3 font-medium">Action</th>
                    <th className="p-3 font-medium">Record ID</th>
                    <th className="p-3 font-medium">Changes</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {logs.map((log) => (
                    <tr key={log.id} className="hover:bg-muted/30 transition-colors">
                      <td className="p-3 whitespace-nowrap">{format(new Date(log.createdAt), "dd MMM yyyy HH:mm")}</td>
                      <td className="p-3 capitalize">{log.table}</td>
                      <td className="p-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          log.action === "DELETE" ? "bg-red-100 text-red-700" : "bg-blue-100 text-blue-700"
                        }`}>
                          {log.action}
                        </span>
                      </td>
                      <td className="p-3 font-mono text-xs text-muted-foreground">{log.recordId}</td>
                      <td className="p-3 max-w-md truncate text-xs">
                        {log.action === "DELETE" ? (
                          <span className="text-red-500">Record deleted</span>
                        ) : (
                          <span className="text-muted-foreground">Updated fields in record</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
