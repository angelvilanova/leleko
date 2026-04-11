import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { OrderWithItems } from '../../types/database';
import {
  Package,
  CheckCircle,
  LogOut,
  Clock,
  Truck,
  User,
  Printer,
  FileText,
} from 'lucide-react';

type StatusConfig = {
  label: string;
  color: string;
  icon: typeof Package;
};

function toYMD(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function OperatorDashboard() {
  const { profile, signOut } = useAuth();
  const [orders, setOrders] = useState<OrderWithItems[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadOrders();

    const channel = supabase
      .channel('orders-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => {
        loadOrders();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const loadOrders = async () => {
    try {
      const { data, error } = await supabase
        .from('orders')
        .select(`
          *,
          notes,
          customers ( id, name, phone, address ),
          profiles!orders_created_by_fkey(id, email, role),
          order_items( *, products(*) )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setOrders((data as OrderWithItems[]) || []);
    } catch (error) {
      console.error('Error loading orders:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDispatch = async (orderId: string) => {
    if (!profile) return;

    try {
      const { error } = await supabase
        .from('orders')
        .update({
          status: 'dispatched',
          dispatched_by: profile.id,
          dispatched_at: new Date().toISOString(),
          cash_date: toYMD(new Date()),
        })
        .eq('id', orderId);

      if (error) throw error;
      loadOrders();
    } catch (error) {
      console.error('Error dispatching order:', error);
    }
  };

  const getStatusConfig = (status: string): StatusConfig => {
    switch (status) {
      case 'pending':
        return { label: 'Pendente', color: 'bg-yellow-100 text-yellow-800 border-yellow-200', icon: Clock as typeof Package };
      case 'dispatched':
        return { label: 'Despachado', color: 'bg-green-100 text-green-800 border-green-200', icon: Truck as typeof Package };
      case 'cancelled':
        return { label: 'Cancelado', color: 'bg-red-100 text-red-800 border-red-200', icon: Package };
      default:
        return { label: status, color: 'bg-gray-100 text-gray-800 border-gray-200', icon: Package };
    }
  };

  const formatPhone = (phone?: string | null): string => {
    if (!phone) return 'Não informado';
    const digits = phone.replace(/\D/g, '');
    if (digits.length === 11) return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
    if (digits.length === 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
    return phone;
  };

  const formatDateTime = (date?: string | null) => {
    if (!date) return 'Não informado';
    const parsed = new Date(date);
    if (Number.isNaN(parsed.getTime())) return 'Não informado';
    return parsed.toLocaleString('pt-BR');
  };

  const buildPrintHtml = (order: OrderWithItems) => {
    const totalItems = order.order_items?.reduce((sum, item) => sum + Number(item.quantity || 0), 0) || 0;

    const itemsHtml = order.order_items
      ?.map((item) => `
        <tr>
          <td class="qty">${item.quantity}x</td>
          <td class="desc">
            <div class="item-name">${item.products?.name || 'Produto'}</div>
            ${item.products?.description ? `<div class="item-note">${item.products.description}</div>` : ''}
          </td>
        </tr>
      `)
      .join('') || '';

    const phoneFormatted = formatPhone(order.customers?.phone);

    return `
      <!DOCTYPE html>
      <html lang="pt-BR">
        <head>
          <meta charset="UTF-8" />
          <title>Pedido ${order.order_number || order.id}</title>
          <style>
            * { box-sizing: border-box; }
            body { margin: 0; padding: 0; background: #ffffff; color: #000000; font-family: Arial, Helvetica, sans-serif; }
            .ticket { width: 80mm; max-width: 100%; margin: 0 auto; padding: 10px; font-size: 12px; line-height: 1.4; }
            .customer-header { border: 2px solid #000; padding: 8px; margin-bottom: 8px; }
            .customer-header-title { text-align: center; font-size: 13px; font-weight: 700; text-transform: uppercase; margin-bottom: 6px; }
            .customer-line { margin-bottom: 4px; word-break: break-word; font-size: 12px; }
            .customer-line.phone { font-size: 16px; font-weight: 700; }
            .customer-name { font-size: 18px; font-weight: 900; margin-bottom: 6px; text-transform: uppercase; text-align: center; line-height: 1.2; word-break: break-word; }
            .cut-line { border-top: 2px dashed #000; margin: 10px 0; position: relative; text-align: center; }
            .cut-line span { position: relative; top: -9px; background: #fff; padding: 0 8px; font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; }
            .center { text-align: center; }
            .title { font-size: 18px; font-weight: 700; text-transform: uppercase; margin-bottom: 4px; }
            .order-number { font-size: 20px; font-weight: 700; text-align: center; margin-bottom: 6px; }
            .divider { border-top: 1px dashed #000; margin: 8px 0; }
            .section-title { font-size: 12px; font-weight: 700; text-transform: uppercase; margin-bottom: 4px; }
            .line { margin-bottom: 3px; word-break: break-word; }
            .line.phone { font-size: 16px; font-weight: 700; }
            table { width: 100%; border-collapse: collapse; }
            td { vertical-align: top; padding: 4px 0; }
            .qty { width: 32px; font-weight: 700; }
            .desc { padding-right: 8px; }
            .item-name { font-weight: 700; }
            .item-note { font-size: 11px; margin-top: 2px; }
            .footer { text-align: center; font-size: 11px; margin-top: 12px; }
            .highlight { font-size: 14px; font-weight: 700; }
            .obs-box { border: 2px solid #000; padding: 6px 8px; margin: 8px 0; }
            .obs-title { font-size: 12px; font-weight: 700; text-transform: uppercase; margin-bottom: 4px; }
            .obs-text { font-size: 13px; font-weight: 700; word-break: break-word; }
            @page { size: auto; margin: 4mm; }
            @media print { html, body { width: 80mm; } .ticket { width: 100%; padding: 0; } }
          </style>
        </head>
        <body>
          <div class="ticket">
            <div class="customer-header">
              <div class="customer-header-title">Conferência do Cliente</div>
              <div class="customer-line"><strong>Pedido:</strong> ${order.order_number || order.id}</div>
              ${order.customers ? `
                <div class="customer-name">${order.customers.name || 'NÃO INFORMADO'}</div>
                <div class="customer-line phone"><strong>Telefone:</strong> ${phoneFormatted}</div>
                <div class="customer-line"><strong>Endereço:</strong> ${order.customers.address || 'Não informado'}</div>
              ` : `<div class="customer-line">Pedido sem cliente associado.</div>`}
              ${order.notes ? `
                <div class="obs-box">
                  <div class="obs-title">Observação</div>
                  <div class="obs-text">${order.notes}</div>
                </div>
              ` : ''}
            </div>
            <div class="cut-line"><span>Destacar aqui</span></div>
            <div class="center">
              <div class="title">Pedido Delivery</div>
              <div class="order-number">${order.order_number || order.id}</div>
            </div>
            <div class="divider"></div>
            <div class="section-title">Cliente</div>
            ${order.customers ? `
              <div class="customer-name">${order.customers.name || 'NÃO INFORMADO'}</div>
              <div class="line phone"><strong>Telefone:</strong> ${phoneFormatted}</div>
              <div class="line"><strong>Endereço:</strong> ${order.customers.address || 'Não informado'}</div>
            ` : `<div class="line">Pedido sem cliente associado.</div>`}
            <div class="divider"></div>
            <div class="section-title">Dados do pedido</div>
            <div class="line"><strong>Status:</strong> ${getStatusConfig(order.status).label}</div>
            <div class="line"><strong>Criado em:</strong> ${formatDateTime(order.created_at)}</div>
            ${order.dispatched_at ? `<div class="line"><strong>Despachado em:</strong> ${formatDateTime(order.dispatched_at)}</div>` : ''}
            ${order.notes ? `
              <div class="divider"></div>
              <div class="obs-box">
                <div class="obs-title">Observação</div>
                <div class="obs-text">${order.notes}</div>
              </div>
            ` : ''}
            <div class="divider"></div>
            <div class="section-title">Itens do pedido</div>
            <table><tbody>${itemsHtml}</tbody></table>
            <div class="divider"></div>
            <div class="line highlight"><strong>Total de itens:</strong> ${totalItems} unidade(s)</div>
            <div class="divider"></div>
            <div class="footer">Impresso pelo painel do operador</div>
          </div>
          <script>
            window.onload = function () {
              window.print();
              window.onafterprint = function () { window.close(); };
            };
          </script>
        </body>
      </html>
    `;
  };

  const handlePrintOrder = (order: OrderWithItems) => {
    const printWindow = window.open('', '_blank', 'width=420,height=800');
    if (!printWindow) {
      alert('Não foi possível abrir a janela de impressão. Verifique se o bloqueador de pop-up está desativado.');
      return;
    }
    printWindow.document.open();
    printWindow.document.write(buildPrintHtml(order));
    printWindow.document.close();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Carregando pedidos...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14">
            <div className="min-w-0">
              <h1 className="text-base font-bold text-gray-900 sm:text-xl truncate">
                Painel do Operador
              </h1>
              <p className="text-xs text-gray-500 truncate">{profile?.email}</p>
            </div>
            <button
              onClick={signOut}
              className="flex items-center gap-1.5 text-gray-600 hover:text-red-600 transition ml-4 shrink-0"
            >
              <LogOut className="w-5 h-5" />
              <span className="hidden sm:inline text-sm font-medium">Sair</span>
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-900 sm:text-2xl">Pedidos ao Vivo</h2>
          <div className="flex items-center gap-1.5 text-xs text-gray-500">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
            Tempo real
          </div>
        </div>

        {orders.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-xl shadow-sm">
            <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">Nenhum pedido encontrado</p>
          </div>
        ) : (
          <div className="space-y-3 sm:space-y-4">
            {orders.map((order) => {
              const statusConfig = getStatusConfig(order.status);
              const StatusIcon = statusConfig.icon;
              const totalItems = order.order_items.reduce(
                (sum, item) => sum + Number(item.quantity || 0), 0
              );

              return (
                <div
                  key={order.id}
                  className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden"
                >
                  <div className="p-4">
                    {/* Order header */}
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-bold text-gray-900 text-base">
                            {order.order_number}
                          </h3>
                          <span className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border ${statusConfig.color}`}>
                            <StatusIcon className="w-3 h-3" />
                            {statusConfig.label}
                          </span>
                        </div>
                        <p className="text-xs text-gray-500 mt-1">
                          {new Date(order.created_at).toLocaleString('pt-BR')}
                        </p>
                      </div>
                    </div>

                    {/* Customer */}
                    <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 mb-3">
                      <div className="flex items-center gap-1.5 mb-1.5">
                        <User className="w-4 h-4 text-blue-600" />
                        <h4 className="font-semibold text-blue-900 text-sm">Cliente</h4>
                      </div>
                      {order.customers ? (
                        <div className="text-sm text-blue-800 space-y-0.5">
                          <p><span className="font-semibold">Nome:</span> {order.customers.name}</p>
                          <p><span className="font-semibold">Tel:</span> {formatPhone(order.customers.phone)}</p>
                          <p className="break-words">
                            <span className="font-semibold">End:</span> {order.customers.address}
                          </p>
                        </div>
                      ) : (
                        <p className="text-sm text-blue-700">Sem cliente associado.</p>
                      )}
                    </div>

                    {/* Notes */}
                    {order.notes && (
                      <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-3">
                        <div className="flex items-center gap-1.5 mb-1">
                          <FileText className="w-4 h-4 text-amber-600" />
                          <h4 className="font-semibold text-amber-900 text-sm">Observação</h4>
                        </div>
                        <p className="text-sm text-amber-800 whitespace-pre-line">{order.notes}</p>
                      </div>
                    )}

                    {/* Items list */}
                    <div className="space-y-1.5 mb-3">
                      {order.order_items.map((item) => (
                        <div
                          key={item.id}
                          className="flex items-center justify-between bg-gray-50 px-3 py-2 rounded-lg"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <Package className="w-4 h-4 text-gray-400 shrink-0" />
                            <span className="text-sm font-medium text-gray-800 truncate">
                              {item.products?.name || 'Produto'}
                            </span>
                          </div>
                          <span className="text-sm font-bold text-gray-900 shrink-0 ml-2">
                            {item.quantity} un.
                          </span>
                        </div>
                      ))}
                    </div>

                    {/* Total */}
                    <div className="flex items-center justify-between py-2 border-t border-gray-100 mb-3">
                      <span className="text-sm text-gray-600 font-medium">Total de itens:</span>
                      <span className="text-lg font-bold text-gray-900">{totalItems} un.</span>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2">
                      <button
                        onClick={() => handlePrintOrder(order)}
                        className="flex-1 flex items-center justify-center gap-2 bg-blue-600 text-white py-2.5 rounded-xl hover:bg-blue-700 transition font-medium text-sm"
                      >
                        <Printer className="w-4 h-4" />
                        Imprimir
                      </button>

                      {order.status === 'pending' && (
                        <button
                          onClick={() => handleDispatch(order.id)}
                          className="flex-1 flex items-center justify-center gap-2 bg-green-600 text-white py-2.5 rounded-xl hover:bg-green-700 transition font-medium text-sm"
                        >
                          <CheckCircle className="w-4 h-4" />
                          Despachar
                        </button>
                      )}
                    </div>

                    {order.dispatched_at && (
                      <p className="mt-2 text-xs text-gray-400 text-center">
                        Despachado: {new Date(order.dispatched_at).toLocaleString('pt-BR')}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
