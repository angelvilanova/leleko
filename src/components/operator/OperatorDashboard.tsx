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
} from 'lucide-react';

type StatusConfig = {
  label: string;
  color: string;
  icon: typeof Package;
};

export function OperatorDashboard() {
  const { profile, signOut } = useAuth();
  const [orders, setOrders] = useState<OrderWithItems[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadOrders();

    const channel = supabase
      .channel('orders-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'orders',
        },
        () => {
          loadOrders();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const loadOrders = async () => {
    try {
      const { data, error } = await supabase
        .from('orders')
        .select(
          `
          *,
          customers ( id, name, phone, address ),
          profiles!orders_created_by_fkey(id, email, role),
          order_items(
            *,
            products(*)
          )
        `
        )
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
        return {
          label: 'Pendente',
          color: 'bg-yellow-100 text-yellow-800 border-yellow-200',
          icon: Clock as typeof Package,
        };
      case 'dispatched':
        return {
          label: 'Despachado',
          color: 'bg-green-100 text-green-800 border-green-200',
          icon: Truck as typeof Package,
        };
      case 'cancelled':
        return {
          label: 'Cancelado',
          color: 'bg-red-100 text-red-800 border-red-200',
          icon: Package,
        };
      default:
        return {
          label: status,
          color: 'bg-gray-100 text-gray-800 border-gray-200',
          icon: Package,
        };
    }
  };

  const formatDateTime = (date?: string | null) => {
    if (!date) return 'Não informado';

    const parsed = new Date(date);
    if (Number.isNaN(parsed.getTime())) return 'Não informado';

    return parsed.toLocaleString('pt-BR');
  };

  const buildPrintHtml = (order: OrderWithItems) => {
    const totalItems =
      order.order_items?.reduce(
        (sum, item) => sum + Number(item.quantity || 0),
        0
      ) || 0;

    const itemsHtml =
      order.order_items
        ?.map(
          (item) => `
            <tr>
              <td class="qty">${item.quantity}x</td>
              <td class="desc">
                <div class="item-name">${item.products?.name || 'Produto'}</div>
                ${
                  item.products?.description
                    ? `<div class="item-note">${item.products.description}</div>`
                    : ''
                }
              </td>
            </tr>
          `
        )
        .join('') || '';

    return `
      <!DOCTYPE html>
      <html lang="pt-BR">
        <head>
          <meta charset="UTF-8" />
          <title>Pedido ${order.order_number || order.id}</title>
          <style>
            * {
              box-sizing: border-box;
            }

            body {
              margin: 0;
              padding: 0;
              background: #ffffff;
              color: #000000;
              font-family: Arial, Helvetica, sans-serif;
            }

            .ticket {
              width: 80mm;
              max-width: 100%;
              margin: 0 auto;
              padding: 10px;
              font-size: 12px;
              line-height: 1.4;
            }

            .customer-header {
              border: 2px solid #000;
              padding: 8px;
              margin-bottom: 8px;
            }

            .customer-header-title {
              text-align: center;
              font-size: 13px;
              font-weight: 700;
              text-transform: uppercase;
              margin-bottom: 6px;
            }

            .customer-line {
              margin-bottom: 4px;
              word-break: break-word;
              font-size: 12px;
            }

            .customer-name {
              font-size: 18px;
              font-weight: 900;
              margin-bottom: 6px;
              text-transform: uppercase;
              text-align: center;
              line-height: 1.2;
              word-break: break-word;
            }

            .cut-line {
              border-top: 2px dashed #000;
              margin: 10px 0;
              position: relative;
              text-align: center;
            }

            .cut-line span {
              position: relative;
              top: -9px;
              background: #fff;
              padding: 0 8px;
              font-size: 10px;
              text-transform: uppercase;
              letter-spacing: 0.5px;
            }

            .center {
              text-align: center;
            }

            .title {
              font-size: 18px;
              font-weight: 700;
              text-transform: uppercase;
              margin-bottom: 4px;
            }

            .order-number {
              font-size: 20px;
              font-weight: 700;
              text-align: center;
              margin-bottom: 6px;
            }

            .divider {
              border-top: 1px dashed #000;
              margin: 8px 0;
            }

            .section-title {
              font-size: 12px;
              font-weight: 700;
              text-transform: uppercase;
              margin-bottom: 4px;
            }

            .line {
              margin-bottom: 3px;
              word-break: break-word;
            }

            table {
              width: 100%;
              border-collapse: collapse;
            }

            td {
              vertical-align: top;
              padding: 4px 0;
            }

            .qty {
              width: 32px;
              font-weight: 700;
            }

            .desc {
              padding-right: 8px;
            }

            .item-name {
              font-weight: 700;
            }

            .item-note {
              font-size: 11px;
              margin-top: 2px;
            }

            .footer {
              text-align: center;
              font-size: 11px;
              margin-top: 12px;
            }

            .highlight {
              font-size: 14px;
              font-weight: 700;
            }

            @page {
              size: auto;
              margin: 4mm;
            }

            @media print {
              html, body {
                width: 80mm;
              }

              .ticket {
                width: 100%;
                padding: 0;
              }
            }
          </style>
        </head>
        <body>
          <div class="ticket">
            <div class="customer-header">
              <div class="customer-header-title">Conferência do Cliente</div>
              <div class="customer-line"><strong>Pedido:</strong> ${order.order_number || order.id}</div>
              ${
                order.customers
                  ? `
                    <div class="customer-name">${order.customers.name || 'NÃO INFORMADO'}</div>
                    <div class="customer-line"><strong>Telefone:</strong> ${order.customers.phone || 'Não informado'}</div>
                    <div class="customer-line"><strong>Endereço:</strong> ${order.customers.address || 'Não informado'}</div>
                  `
                  : `
                    <div class="customer-line">Pedido sem cliente associado.</div>
                  `
              }
            </div>

            <div class="cut-line">
              <span>Destacar aqui</span>
            </div>

            <div class="center">
              <div class="title">Pedido Delivery</div>
              <div class="order-number">${order.order_number || order.id}</div>
            </div>

            <div class="divider"></div>

            <div class="section-title">Cliente</div>
            ${
              order.customers
                ? `
                  <div class="customer-name">${order.customers.name || 'NÃO INFORMADO'}</div>
                  <div class="line"><strong>Telefone:</strong> ${order.customers.phone || 'Não informado'}</div>
                  <div class="line"><strong>Endereço:</strong> ${order.customers.address || 'Não informado'}</div>
                `
                : `
                  <div class="line">Pedido sem cliente associado.</div>
                `
            }

            <div class="divider"></div>

            <div class="section-title">Dados do pedido</div>
            <div class="line"><strong>Status:</strong> ${getStatusConfig(order.status).label}</div>
            <div class="line"><strong>Criado em:</strong> ${formatDateTime(order.created_at)}</div>
            ${
              order.dispatched_at
                ? `<div class="line"><strong>Despachado em:</strong> ${formatDateTime(order.dispatched_at)}</div>`
                : ''
            }

            <div class="divider"></div>

            <div class="section-title">Itens do pedido</div>
            <table>
              <tbody>
                ${itemsHtml}
              </tbody>
            </table>

            <div class="divider"></div>

            <div class="line highlight"><strong>Total de itens:</strong> ${totalItems} unidade(s)</div>

            <div class="divider"></div>

            <div class="footer">
              Impresso pelo painel do operador
            </div>
          </div>

          <script>
            window.onload = function () {
              window.print();
              window.onafterprint = function () {
                window.close();
              };
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
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Painel do Operador</h1>
              <p className="text-sm text-gray-600">{profile?.email}</p>
            </div>
            <button
              onClick={signOut}
              className="flex items-center gap-2 text-gray-700 hover:text-red-600 transition"
            >
              <LogOut className="w-5 h-5" />
              Sair
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-gray-900">Pedidos ao Vivo</h2>
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
            Atualização automática
          </div>
        </div>

        {orders.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-xl shadow-sm">
            <Package className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600 text-lg">Nenhum pedido encontrado</p>
          </div>
        ) : (
          <div className="space-y-4">
            {orders.map((order) => {
              const statusConfig = getStatusConfig(order.status);
              const StatusIcon = statusConfig.icon;

              return (
                <div
                  key={order.id}
                  className="bg-white rounded-xl shadow-md border border-gray-200 overflow-hidden hover:shadow-lg transition"
                >
                  <div className="p-6">
                    <div className="flex flex-col gap-4 mb-4 lg:flex-row lg:items-start lg:justify-between">
                      <div>
                        <div className="flex items-center gap-3 mb-2 flex-wrap">
                          <h3 className="text-xl font-bold text-gray-900">
                            {order.order_number}
                          </h3>
                          <span
                            className={`flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium border ${statusConfig.color}`}
                          >
                            <StatusIcon className="w-4 h-4" />
                            {statusConfig.label}
                          </span>
                        </div>
                        <p className="text-sm text-gray-600">
                          Criado em: {new Date(order.created_at).toLocaleString('pt-BR')}
                        </p>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <button
                          onClick={() => handlePrintOrder(order)}
                          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition font-medium"
                        >
                          <Printer className="w-5 h-5" />
                          Imprimir pedido
                        </button>

                        {order.status === 'pending' && (
                          <button
                            onClick={() => handleDispatch(order.id)}
                            className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition font-medium"
                          >
                            <CheckCircle className="w-5 h-5" />
                            Despachar
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="mb-4 bg-blue-50 border border-blue-200 rounded-xl p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <User className="w-5 h-5 text-blue-700" />
                        <h4 className="font-semibold text-blue-900">Cliente</h4>
                      </div>

                      {order.customers ? (
                        <div className="text-sm text-blue-900 space-y-1">
                          <p>
                            <span className="font-semibold">Nome:</span> {order.customers.name}
                          </p>
                          <p>
                            <span className="font-semibold">Telefone:</span> {order.customers.phone}
                          </p>
                          <p>
                            <span className="font-semibold">Endereço:</span> {order.customers.address}
                          </p>
                        </div>
                      ) : (
                        <p className="text-sm text-blue-900">
                          Este pedido está sem cliente associado.
                        </p>
                      )}
                    </div>

                    <div className="border-t pt-4">
                      <h4 className="font-semibold text-gray-900 mb-3">Itens do Pedido:</h4>
                      <div className="space-y-2">
                        {order.order_items.map((item) => (
                          <div
                            key={item.id}
                            className="flex items-center justify-between bg-gray-50 p-3 rounded-lg"
                          >
                            <div className="flex items-center gap-3">
                              <Package className="w-5 h-5 text-gray-500" />
                              <div>
                                <p className="font-medium text-gray-900">
                                  {item.products?.name || 'Produto'}
                                </p>
                                {item.products?.description && (
                                  <p className="text-sm text-gray-600">
                                    {item.products.description}
                                  </p>
                                )}
                              </div>
                            </div>
                            <span className="font-semibold text-gray-900">
                              {item.quantity} un.
                            </span>
                          </div>
                        ))}
                      </div>

                      <div className="mt-4 pt-3 border-t flex items-center justify-between">
                        <span className="text-gray-700 font-medium">Total de itens:</span>
                        <span className="text-xl font-bold text-gray-900">
                          {order.order_items.reduce(
                            (sum, item) => sum + Number(item.quantity || 0),
                            0
                          )}{' '}
                          unidades
                        </span>
                      </div>
                    </div>

                    {order.dispatched_at && (
                      <div className="mt-4 pt-4 border-t text-sm text-gray-600">
                        Despachado em: {new Date(order.dispatched_at).toLocaleString('pt-BR')}
                      </div>
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
