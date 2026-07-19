import { createFileRoute } from "@tanstack/react-router";

import { InvoiceView } from "@/components/invoice/InvoiceView";
import { getInvoiceFn } from "@/lib/invoices-data";

export const Route = createFileRoute("/invoice/$invoiceNo")({
  loader: async ({ params }) => getInvoiceFn({ data: params.invoiceNo }),
  component: InvoiceRoute,
});

function InvoiceRoute() {
  const result = Route.useLoaderData();
  const { invoiceNo } = Route.useParams();
  return <InvoiceView result={result} invoiceNo={invoiceNo} />;
}
