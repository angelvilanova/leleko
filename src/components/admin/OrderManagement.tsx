import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Check, Edit3, Trash2, X, Plus, Minus, Package, User, CalendarDays, ArrowUpDown, FileText, Printer, Truck, Users } from 'lucide-react';

type Product = {
  id: string;
  name: string;
  description?: string | null;
  stock_quantity: number;
  price: number;
  cost_price: number;
};

type Customer = {
  id: string;
  name: string;
  phone: string;
  address: string;
};

type OrderItem = {
  id: string;
  order_id: string;
  product_id: string;
  quantity: number;
  unit_price: number;
  unit_cost?: number;
  products: Product | null;
};

type OrderRow = {
  id: string;
  order_number: string;
  status: 'pending' | 'dispatched' | 'cancelled';
  created_at: string;
  dispatched_at: string | null;
  cash_date?: string | null;
  notes?: string | null;
  customer_id: string | null;
  customers: Customer | null;
  order_items: OrderItem[];
};

type DraftItem = {
  id: string;
  product_id: string;
  quantity: number;
  unit_price: number;
  unit_cost: number;
};

const statusLabel: Record<OrderRow['status'], string> = {
  pending: 'Pendente',
  dispatched: 'Despachado',
  cancelled: 'Cancelado',
};

const statusClasses: Record<OrderRow['status'], string> = {
  pending: 'bg-yellow-50 text-yellow-700 border-yellow-200',
  dispatched: 'bg-green-50 text-green-700 border-green-200',
  cancelled: 'bg-red-50 text-red-700 border-red-200',
};

function toStartISO(yyyyMmDd: string) {
  const [y, m, d] = yyyyMmDd.split('-').map(Number);
  return new Date(y, m - 1, d, 0, 0, 0, 0).toISOString();
}

function toEndISO(yyyyMmDd: string) {
  const [y, m, d] = yyyyMmDd.split('-').map(Number);
  return new Date(y, m - 1, d, 23, 59, 59, 999).toISOString();
}

function toYMD(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function startOfMonthYMD(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-01`;
}

function addDays(date: Date, days: number) {
  const x = new Date(date);
  x.setDate(x.getDate() + days);
  return x;
}

function formatBRL(value: number) {
  return Number(value || 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
}

function formatPhoneDisplay(phone?: string | null): string {
  if (!phone) return 'Não informado';
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 11) return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  if (digits.length === 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  return phone;
}

function normalizePhone(value: string) {
  return value.replace(/\D/g, '');
}

function formatCashDate(value?: string | null) {
  if (!value) return 'Não informada';

  const parts = value.split('-');
  if (parts.length !== 3) return value;

  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

export function OrderManagement() {
  const { profile } = useAuth();

  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);

  const [expandedId, setExpandedId] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftStatus, setDraftStatus] = useState<OrderRow['status']>('pending');
  const [draftCashDate, setDraftCashDate] = useState<string>('');
  const [draftItems, setDraftItems] = useState<DraftItem[]>([]);
  const [draftCustomerId, setDraftCustomerId] = useState<string>('');
  const [customerQuery, setCustomerQuery] = useState('');
  const [saving, setSaving] = useState(false);

  const [showNewCustomer, setShowNewCustomer] = useState(false);
  const [newCustomerName, setNewCustomerName] = useState('');
  const [newCustomerPhone, setNewCustomerPhone] = useState('');
  const [newCustomerAddress, setNewCustomerAddress] = useState('');
  const [customerError, setCustomerError] = useState<string | null>(null);

  const [query, setQuery] = useState('');
  const [sortAsc, setSortAsc] = useState(false);
  const [dispatchFrom, setDispatchFrom] = useState('');
  const [dispatchTo, setDispatchTo] = useState('');

  useEffect(() => {
    (async () => {
      await Promise.all([loadOrders(), loadProducts(), loadCustomers()]);
      setLoading(false);
    })();
  }, []);

  const filteredCustomers = useMemo(() => {
    const q = customerQuery.trim().toLowerCase();
    if (!q) return customers;

    const qPhone = normalizePhone(q);

    return customers.filter((c) => {
      const name = c.name?.toLowerCase() || '';
      const address = c.address?.toLowerCase() || '';
      const phone = normalizePhone(c.phone || '');

      return (
        name.includes(q) ||
        address.includes(q) ||
        (qPhone && phone.includes(qPhone))
      );
    });
  }, [customers, customerQuery]);

  const filteredOrders = useMemo(() => {
    const q = query.trim().toLowerCase();
    let result = orders;

    if (q) {
      result = result.filter((o) => {
        const c = o.customers;
        const translatedStatus = statusLabel[o.status].toLowerCase();
        const cashDateLabel = formatCashDate(o.cash_date).toLowerCase();

        return (
          o.order_number.toLowerCase().includes(q) ||
          o.status.toLowerCase().includes(q) ||
          translatedStatus.includes(q) ||
          cashDateLabel.includes(q) ||
          (c?.name?.toLowerCase().includes(q) ?? false) ||
          (c?.phone?.toLowerCase().includes(q) ?? false) ||
          (c?.address?.toLowerCase().includes(q) ?? false)
        );
      });
    }

    if (sortAsc) {
      result = [...result].reverse();
    }

    return result;
  }, [orders, query, sortAsc]);

  async function loadProducts() {
    const { data, error } = await supabase
      .from('products')
      .select('id,name,description,stock_quantity,price,cost_price')
      .eq('active', true)
      .order('name');

    if (error) {
      console.error(error);
      return;
    }

    setProducts((data || []) as Product[]);
  }

  async function loadCustomers() {
    const { data, error } = await supabase
      .from('customers')
      .select('id,name,phone,address')
      .order('name');

    if (error) {
      console.error(error);
      return;
    }

    setCustomers((data || []) as Customer[]);
  }

  async function createCustomer() {
    setCustomerError(null);

    const name = newCustomerName.trim();
    const phone = normalizePhone(newCustomerPhone);
    const address = newCustomerAddress.trim();

    if (!name || !phone || !address) {
      setCustomerError('Preencha Nome, Telefone e Endereço.');
      return;
    }

    try {
      const { data: existing, error: existingErr } = await supabase
        .from('customers')
        .select('id')
        .eq('phone', phone)
        .maybeSingle();

      if (existingErr) throw existingErr;

      if (existing?.id) {
        setDraftCustomerId(existing.id);
        setShowNewCustomer(false);
        setCustomerError('Já existe um cliente com esse telefone. Selecionei ele pra você.');
        return;
      }

      const { data, error } = await supabase
        .from('customers')
        .insert([{ name, phone, address }])
        .select('id,name,phone,address')
        .single();

      if (error) throw error;

      const created = data as Customer;

      setCustomers((prev) => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)));
      setDraftCustomerId(created.id);
      setShowNewCustomer(false);
      setNewCustomerName('');
      setNewCustomerPhone('');
      setNewCustomerAddress('');
      setCustomerError(null);
    } catch (error) {
      console.error('Error creating customer:', error);
      setCustomerError('Erro ao cadastrar cliente. Verifique as policies (RLS) no Supabase.');
    }
  }

  async function loadOrders() {
    let q = supabase
      .from('orders')
      .select(
        `
        id,
        order_number,
        status,
        created_at,
        dispatched_at,
        cash_date,
        notes,
        customer_id,
        customers ( id, name, phone, address ),
        order_items (
          id,
          order_id,
          product_id,
          quantity,
          unit_price,
          unit_cost,
          products ( id, name, description, stock_quantity )
        )
      `
      )
      .order('created_at', { ascending: false });

    if (dispatchFrom || dispatchTo) {
      q = q.eq('status', 'dispatched');
      if (dispatchFrom) q = q.gte('dispatched_at', toStartISO(dispatchFrom));
      if (dispatchTo) q = q.lte('dispatched_at', toEndISO(dispatchTo));
    }

    const { data, error } = await q;

    if (error) {
      console.error(error);
      return;
    }

    setOrders((data || []) as OrderRow[]);
  }

  function applyQuickRange(range: 'today' | 'yesterday' | 'month') {
    const now = new Date();

    if (range === 'today') {
      const ymd = toYMD(now);
      setDispatchFrom(ymd);
      setDispatchTo(ymd);
      return;
    }

    if (range === 'yesterday') {
      const y = toYMD(addDays(now, -1));
      setDispatchFrom(y);
      setDispatchTo(y);
      return;
    }

    setDispatchFrom(startOfMonthYMD(now));
    setDispatchTo(toYMD(now));
  }

  function clearFilters() {
    setDispatchFrom('');
    setDispatchTo('');
  }

  function startEdit(order: OrderRow) {
    setEditingId(order.id);
    setDraftStatus(order.status);
    setDraftCashDate(order.cash_date || toYMD(new Date()));
    setDraftCustomerId(order.customer_id || '');
    setCustomerQuery('');
    setCustomerError(null);
    setDraftItems(
      order.order_items.map((it) => ({
        id: it.id,
        product_id: it.product_id,
        quantity: it.quantity,
        unit_price: Number(it.unit_price || 0),
        unit_cost: Number(it.unit_cost || 0),
      }))
    );
    setExpandedId(order.id);
  }

  function cancelEdit() {
    setEditingId(null);
    setDraftItems([]);
    setDraftCashDate('');
    setDraftCustomerId('');
    setCustomerQuery('');
    setCustomerError(null);
  }

  function updateDraftItem(itemId: string, patch: Partial<DraftItem>) {
    setDraftItems((prev) => prev.map((it) => (it.id === itemId ? { ...it, ...patch } : it)));
  }

  function removeDraftItem(itemId: string) {
    setDraftItems((prev) => prev.filter((it) => it.id !== itemId));
  }

  function addDraftItem() {
    const tempId = `tmp_${Math.random().toString(16).slice(2)}`;
    const firstProduct = products[0];
    if (!firstProduct) return;

    setDraftItems((prev) => [
      ...prev,
      {
        id: tempId,
        product_id: firstProduct.id,
        quantity: 1,
        unit_price: Number(firstProduct.price || 0),
        unit_cost: Number(firstProduct.cost_price || 0),
      },
    ]);
  }

  async function saveEdit(orderId: string) {
    setSaving(true);

    try {
      // 1. Buscar status atual do pedido e itens no banco
      const { data: orderData, error: orderErr } = await supabase
        .from('orders')
        .select('status')
        .eq('id', orderId)
        .single();

      if (orderErr) throw orderErr;

      const previousStatus = orderData.status as OrderRow['status'];

      const { data: currentItems, error: curErr } = await supabase
        .from('order_items')
        .select('id, product_id, quantity')
        .eq('order_id', orderId);

      if (curErr) throw curErr;

      const current = (currentItems || []) as Array<{
        id: string;
        product_id: string;
        quantity: number;
      }>;

      // 2. Montar payload de status
      const updatePayload: {
        status: OrderRow['status'];
        dispatched_at?: string | null;
        cash_date?: string | null;
        customer_id?: string | null;
      } = { status: draftStatus, customer_id: draftCustomerId || null };

      if (draftStatus === 'dispatched') {
        // Só atualiza dispatched_at quando o pedido está sendo despachado pela primeira vez.
        if (previousStatus !== 'dispatched') {
          updatePayload.dispatched_at = new Date().toISOString();
        }
      } else if (draftStatus === 'pending' || draftStatus === 'cancelled') {
        updatePayload.dispatched_at = null;
      }

      // Sempre persistir a data do caixa escolhida no formulário.
      // Atualizar isso recoloca o pedido no caixa do dia correspondente.
      if (draftCashDate) {
        updatePayload.cash_date = draftCashDate;
      }

      const { error: stErr } = await supabase
        .from('orders')
        .update(updatePayload)
        .eq('id', orderId);

      if (stErr) throw stErr;

      // 3. Lógica de estoque baseada na transição de status
      const becomingCancelled = draftStatus === 'cancelled' && previousStatus !== 'cancelled';
      const reopening = previousStatus === 'cancelled' && draftStatus !== 'cancelled';

      if (becomingCancelled) {
        // Cancelando pedido ativo: devolver estoque de todos os itens atuais
        for (const it of current) {
          const { error } = await supabase.rpc('increment_stock', {
            p_id: it.product_id,
            qty: it.quantity,
          });
          if (error) throw error;
        }

        // Atualizar apenas status dos itens existentes (sem mexer em estoque novamente)
        const existingDraft = draftItems.filter((d) => !d.id.startsWith('tmp_'));
        for (const d of existingDraft) {
          const prod = products.find((p) => p.id === d.product_id);
          const { error } = await supabase
            .from('order_items')
            .update({
              product_id: d.product_id,
              quantity: d.quantity,
              unit_price: d.unit_price || Number(prod?.price || 0),
              unit_cost: d.unit_cost || Number(prod?.cost_price || 0),
            })
            .eq('id', d.id);
          if (error) throw error;
        }

      } else if (reopening) {
        // Reabrindo pedido cancelado: debitar estoque dos itens do draft
        const existingDraft = draftItems.filter((d) => !d.id.startsWith('tmp_'));
        const newDraft = draftItems.filter((d) => d.id.startsWith('tmp_'));

        for (const d of existingDraft) {
          const prod = products.find((p) => p.id === d.product_id);
          const { error } = await supabase
            .from('order_items')
            .update({
              product_id: d.product_id,
              quantity: d.quantity,
              unit_price: d.unit_price || Number(prod?.price || 0),
              unit_cost: d.unit_cost || Number(prod?.cost_price || 0),
            })
            .eq('id', d.id);
          if (error) throw error;

          const { error: stockErr } = await supabase.rpc('decrement_stock', {
            p_id: d.product_id,
            qty: d.quantity,
          });
          if (stockErr) throw stockErr;
        }

        if (newDraft.length > 0) {
          const payload = newDraft.map((d) => {
            const prod = products.find((p) => p.id === d.product_id);
            return {
              order_id: orderId,
              product_id: d.product_id,
              quantity: d.quantity,
              unit_price: d.unit_price || Number(prod?.price || 0),
              unit_cost: d.unit_cost || Number(prod?.cost_price || 0),
            };
          });
          const { error } = await supabase.from('order_items').insert(payload);
          if (error) throw error;

          for (const d of newDraft) {
            const { error: stockErr } = await supabase.rpc('decrement_stock', {
              p_id: d.product_id,
              qty: d.quantity,
            });
            if (stockErr) throw stockErr;
          }
        }

      } else {
        // Edição normal (sem mudança de cancelled): devolve estoque antigo e aplica novo

        // 3a. Devolver estoque dos itens atuais no banco
        for (const it of current) {
          const { error } = await supabase.rpc('increment_stock', {
            p_id: it.product_id,
            qty: it.quantity,
          });
          if (error) throw error;
        }

        const existingDraft = draftItems.filter((d) => !d.id.startsWith('tmp_'));
        const newDraft = draftItems.filter((d) => d.id.startsWith('tmp_'));

        // 3b. Atualizar itens existentes
        for (const d of existingDraft) {
          const prod = products.find((p) => p.id === d.product_id);
          const { error } = await supabase
            .from('order_items')
            .update({
              product_id: d.product_id,
              quantity: d.quantity,
              unit_price: d.unit_price || Number(prod?.price || 0),
              unit_cost: d.unit_cost || Number(prod?.cost_price || 0),
            })
            .eq('id', d.id);
          if (error) throw error;
        }

        // 3c. Inserir novos itens
        if (newDraft.length > 0) {
          const payload = newDraft.map((d) => {
            const prod = products.find((p) => p.id === d.product_id);
            return {
              order_id: orderId,
              product_id: d.product_id,
              quantity: d.quantity,
              unit_price: d.unit_price || Number(prod?.price || 0),
              unit_cost: d.unit_cost || Number(prod?.cost_price || 0),
            };
          });
          const { error } = await supabase.from('order_items').insert(payload);
          if (error) throw error;
        }

        // 3d. Remover itens deletados do draft
        const draftRealIds = new Set(existingDraft.map((d) => d.id));
        const removed = current.filter((c) => !draftRealIds.has(c.id));
        for (const r of removed) {
          const { error } = await supabase.from('order_items').delete().eq('id', r.id);
          if (error) throw error;
        }

        // 3e. Debitar estoque dos itens finais
        const { data: finalItems, error: finErr } = await supabase
          .from('order_items')
          .select('product_id, quantity')
          .eq('order_id', orderId);

        if (finErr) throw finErr;

        const finalIt = (finalItems || []) as Array<{ product_id: string; quantity: number }>;

        for (const it of finalIt) {
          const { error } = await supabase.rpc('decrement_stock', {
            p_id: it.product_id,
            qty: it.quantity,
          });
          if (error) throw new Error(`Estoque insuficiente para um ou mais produtos.`);
        }
      }

      setEditingId(null);
      setDraftItems([]);
      setDraftCashDate('');
      setDraftCustomerId('');
      setCustomerQuery('');
      setCustomerError(null);
      await Promise.all([loadOrders(), loadProducts()]);
    } catch (e: any) {
      console.error(e);
      alert(`Não foi possível salvar: ${e?.message || 'Verifique estoque e policies. (Detalhes no console)'}`);
      await Promise.all([loadOrders(), loadProducts()]);
      setEditingId(null);
      setDraftItems([]);
      setDraftCashDate('');
      setDraftCustomerId('');
      setCustomerQuery('');
      setCustomerError(null);
    } finally {
      setSaving(false);
    }
  }

  async function deleteOrder(order: OrderRow) {
    const ok = confirm(`Apagar o pedido ${order.order_number}? Isso não pode ser desfeito.`);
    if (!ok) return;

    try {
      for (const it of order.order_items) {
        const { data: prod, error: pErr } = await supabase
          .from('products')
          .select('id, stock_quantity')
          .eq('id', it.product_id)
          .single();

        if (pErr) throw pErr;

        const { error: uErr } = await supabase
          .from('products')
          .update({ stock_quantity: (prod.stock_quantity as number) + it.quantity })
          .eq('id', it.product_id);

        if (uErr) throw uErr;
      }

      const { error } = await supabase.from('orders').delete().eq('id', order.id);
      if (error) throw error;

      await Promise.all([loadOrders(), loadProducts()]);
    } catch (e) {
      console.error(e);
      alert('Erro ao apagar o pedido. Veja o console.');
    }
  }

  async function handleQuickDispatch(order: OrderRow) {
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
        .eq('id', order.id);

      if (error) throw error;
      await loadOrders();
    } catch (e) {
      console.error(e);
      alert('Não foi possível despachar o pedido.');
    }
  }

  function buildPrintHtml(order: OrderRow) {
    const items = order.order_items || [];
    const totalItems = items.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
    const orderTotal = items.reduce(
      (sum, item) => sum + Number(item.quantity || 0) * Number(item.unit_price || 0),
      0
    );

    const itemsHtml = items
      .map((item) => {
        const qty = Number(item.quantity || 0);
        const unitPrice = Number(item.unit_price || 0);
        const subtotal = qty * unitPrice;

        return `
          <tr>
            <td class="qty">${qty}x</td>
            <td class="desc">
              <div class="item-name">${item.products?.name || 'Produto'}</div>
              ${item.products?.description ? `<div class="item-note">${item.products.description}</div>` : ''}
              <div class="item-price">
                Unit.: ${formatBRL(unitPrice)}
                &middot; Subtotal: <strong>${formatBRL(subtotal)}</strong>
              </div>
            </td>
          </tr>
        `;
      })
      .join('');

    const phoneFormatted = formatPhoneDisplay(order.customers?.phone);

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
            .item-price { font-size: 11px; margin-top: 2px; }
            .footer { text-align: center; font-size: 11px; margin-top: 12px; }
            .highlight { font-size: 14px; font-weight: 700; }
            .total-line { font-size: 16px; font-weight: 900; margin-top: 4px; display: flex; justify-content: space-between; }
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
            <div class="line"><strong>Status:</strong> ${statusLabel[order.status]}</div>
            <div class="line"><strong>Criado em:</strong> ${new Date(order.created_at).toLocaleString('pt-BR')}</div>
            ${order.dispatched_at ? `<div class="line"><strong>Despachado em:</strong> ${new Date(order.dispatched_at).toLocaleString('pt-BR')}</div>` : ''}
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
            <div class="total-line"><span>TOTAL</span><span>${formatBRL(orderTotal)}</span></div>
            <div class="divider"></div>
            <div class="footer">Impresso pelo painel do administrador</div>
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
  }

  function handlePrintOrder(order: OrderRow) {
    const printWindow = window.open('', '_blank', 'width=420,height=800');
    if (!printWindow) {
      alert('Não foi possível abrir a janela de impressão. Verifique se o bloqueador de pop-up está desativado.');
      return;
    }
    printWindow.document.open();
    printWindow.document.write(buildPrintHtml(order));
    printWindow.document.close();
  }

  if (loading) {
    return <div className="text-center py-8 text-gray-600 dark:text-slate-400">Carregando pedidos...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Gerenciar Pedidos</h2>

        <div className="flex items-center gap-3 flex-wrap">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="border border-gray-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white rounded-lg px-3 py-2 text-sm w-80 max-w-full"
            placeholder="Buscar por pedido, status, cliente..."
          />

          <button
            onClick={() => {
              applyQuickRange('today');
              setTimeout(loadOrders, 0);
            }}
            className="px-3 py-2 rounded-lg border border-gray-300 dark:border-slate-600 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700/50 text-sm"
          >
            Hoje
          </button>

          <button
            onClick={() => {
              applyQuickRange('yesterday');
              setTimeout(loadOrders, 0);
            }}
            className="px-3 py-2 rounded-lg border border-gray-300 dark:border-slate-600 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700/50 text-sm"
          >
            Ontem
          </button>

          <button
            onClick={() => {
              applyQuickRange('month');
              setTimeout(loadOrders, 0);
            }}
            className="px-3 py-2 rounded-lg border border-gray-300 dark:border-slate-600 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700/50 text-sm"
          >
            Este mês
          </button>

          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-600 dark:text-slate-400">Despacho De</label>
            <input
              type="date"
              value={dispatchFrom}
              onChange={(e) => setDispatchFrom(e.target.value)}
              className="border border-gray-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white rounded-lg px-3 py-2 text-sm"
            />
          </div>

          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-600 dark:text-slate-400">Até</label>
            <input
              type="date"
              value={dispatchTo}
              onChange={(e) => setDispatchTo(e.target.value)}
              className="border border-gray-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white rounded-lg px-3 py-2 text-sm"
            />
          </div>

          <button
            onClick={loadOrders}
            className="px-4 py-2 rounded-lg border border-gray-300 dark:border-slate-600 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700/50 text-sm"
          >
            Filtrar
          </button>

          <button
            onClick={() => {
              clearFilters();
              setTimeout(loadOrders, 0);
            }}
            className="px-4 py-2 rounded-lg border border-gray-300 dark:border-slate-600 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700/50 text-sm"
          >
            Limpar
          </button>

          <button
            onClick={() => setSortAsc((prev) => !prev)}
            className="px-3 py-2 rounded-lg border border-gray-300 dark:border-slate-600 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700/50 text-sm flex items-center gap-1"
            title={sortAsc ? 'Mais antigos primeiro' : 'Mais recentes primeiro'}
          >
            <ArrowUpDown size={16} />
            {sortAsc ? 'Antigos' : 'Recentes'}
          </button>
        </div>
      </div>

      {filteredOrders.length === 0 ? (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 shadow-sm p-8 text-center text-gray-600 dark:text-slate-400">
          Nenhum pedido encontrado.
        </div>
      ) : (
        <div className="space-y-4">
          {filteredOrders.map((order) => {
            const expanded = expandedId === order.id;
            const editing = editingId === order.id;

            const orderTotal = order.order_items.reduce(
              (sum, item) =>
                sum + Number(item.quantity || 0) * Number(item.unit_price || 0),
              0
            );

            return (
              <div key={order.id} className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 shadow-sm overflow-hidden">
                <div className="p-5 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 sm:gap-4">
                  <div className="min-w-0 flex-1">
                    <button
                      onClick={() => setExpandedId(expanded ? null : order.id)}
                      className="text-left w-full"
                      title="Expandir/Fechar"
                    >
                      <div className="flex items-center gap-3 flex-wrap">
                        <div>
                          <div className="text-lg font-bold text-gray-900 dark:text-white">{order.order_number}</div>
                          <div className="text-sm text-gray-600 dark:text-slate-400">
                            Criado em: {new Date(order.created_at).toLocaleString('pt-BR')}
                          </div>
                          {order.dispatched_at && (
                            <div className="text-sm text-gray-600 dark:text-slate-400">
                              Despachado em: {new Date(order.dispatched_at).toLocaleString('pt-BR')}
                            </div>
                          )}
                          <div className="text-sm text-gray-600 flex items-center gap-1">
                            <CalendarDays className="w-4 h-4" />
                            Data do caixa: {formatCashDate(order.cash_date)}
                          </div>
                        </div>

                        <span className={`text-xs px-3 py-1 rounded-full border ${statusClasses[order.status]}`}>
                          Status: <span className="font-semibold">{statusLabel[order.status]}</span>
                        </span>
                      </div>
                    </button>

                    <div className="mt-3 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-lg p-3 text-sm">
                      <div className="flex items-center gap-2 mb-1 text-blue-900 dark:text-blue-100 font-semibold">
                        <User className="w-4 h-4" /> Cliente
                      </div>
                      {order.customers ? (
                        <div className="text-blue-900 dark:text-blue-200 space-y-1">
                          <div><span className="font-semibold">Nome:</span> {order.customers.name}</div>
                          <div><span className="font-semibold">Telefone:</span> {order.customers.phone}</div>
                          <div><span className="font-semibold">Endereço:</span> {order.customers.address}</div>
                        </div>
                      ) : (
                        <div className="text-blue-900 dark:text-blue-200">Sem cliente associado</div>
                      )}
                    </div>

                    {order.notes && (
                      <div className="mt-3 bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm">
                        <div className="flex items-center gap-2 mb-1 text-amber-900 font-semibold">
                          <FileText className="w-4 h-4" /> Observação
                        </div>
                        <p className="text-amber-800 whitespace-pre-line">{order.notes}</p>
                      </div>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-2 sm:justify-end w-full sm:w-auto">
                    {!editing ? (
                      <>
                        <button
                          onClick={() => handlePrintOrder(order)}
                          className="px-3 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 flex items-center gap-2"
                          title="Imprimir pedido (com valores)"
                        >
                          <Printer className="w-4 h-4" />
                          Imprimir
                        </button>

                        {order.status === 'pending' && (
                          <button
                            onClick={() => handleQuickDispatch(order)}
                            className="px-3 py-2 rounded-lg bg-green-600 text-white hover:bg-green-700 flex items-center gap-2"
                            title="Despachar pedido"
                          >
                            <Truck className="w-4 h-4" />
                            Despachar
                          </button>
                        )}

                        <button
                          onClick={() => startEdit(order)}
                          className="px-3 py-2 rounded-lg border border-gray-300 dark:border-slate-600 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700/50 flex items-center gap-2"
                          title="Editar pedido"
                        >
                          <Edit3 className="w-4 h-4" />
                          Editar
                        </button>

                        <button
                          onClick={() => deleteOrder(order)}
                          className="px-3 py-2 rounded-lg border border-red-200 text-red-700 hover:bg-red-50 flex items-center gap-2"
                          title="Apagar pedido"
                        >
                          <Trash2 className="w-4 h-4" />
                          Apagar
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={() => saveEdit(order.id)}
                          disabled={saving}
                          className="px-3 py-2 rounded-lg bg-green-600 text-white hover:bg-green-700 flex items-center gap-2 disabled:opacity-50"
                          title="Salvar"
                        >
                          <Check className="w-4 h-4" />
                          {saving ? 'Salvando...' : 'Salvar'}
                        </button>
                        <button
                          onClick={cancelEdit}
                          disabled={saving}
                          className="px-3 py-2 rounded-lg border border-gray-300 dark:border-slate-600 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700/50 flex items-center gap-2 disabled:opacity-50"
                          title="Cancelar"
                        >
                          <X className="w-4 h-4" />
                          Cancelar
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {expanded && (
                  <div className="px-5 pb-5">
                    <div className="border-t dark:border-slate-700 pt-4 space-y-4">
                      <div className="flex items-center justify-between gap-3 flex-wrap">
                        <div className="font-semibold text-gray-900 dark:text-white">Status do pedido</div>

                        {editing ? (
                          <select
                            value={draftStatus}
                            onChange={(e) => setDraftStatus(e.target.value as OrderRow['status'])}
                            className="border border-gray-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white rounded-lg px-3 py-2 text-sm"
                          >
                            <option value="pending">Pendente</option>
                            <option value="dispatched">Despachado</option>
                            <option value="cancelled">Cancelado</option>
                          </select>
                        ) : (
                          <div className="text-sm text-gray-700 dark:text-slate-300">
                            <span className="font-semibold">{statusLabel[order.status]}</span>
                          </div>
                        )}
                      </div>

                      {editing && (
                        <div className="flex items-center justify-between gap-3 flex-wrap bg-amber-50 border border-amber-200 rounded-lg p-3">
                          <div>
                            <div className="font-semibold text-amber-900 flex items-center gap-2">
                              <CalendarDays className="w-4 h-4" />
                              Data do caixa
                            </div>
                            <p className="text-xs text-amber-800 mt-1">
                              Alterar a data move o pedido para o caixa do dia escolhido (e remove do dia anterior).
                            </p>
                          </div>
                          <input
                            type="date"
                            value={draftCashDate}
                            onChange={(e) => setDraftCashDate(e.target.value)}
                            className="border border-amber-300 rounded-lg px-3 py-2 text-sm bg-white"
                          />
                        </div>
                      )}

                      {editing && (
                        <div className="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-lg p-3 space-y-3">
                          <div className="flex items-center justify-between gap-2 flex-wrap">
                            <div className="flex items-center gap-2 text-blue-900 dark:text-blue-100 font-semibold">
                              <Users className="w-4 h-4" />
                              Cliente do pedido
                            </div>
                            <button
                              onClick={() => {
                                setCustomerError(null);
                                setShowNewCustomer(true);
                              }}
                              className="text-sm bg-green-600 text-white px-3 py-1.5 rounded-lg hover:bg-green-700 transition flex items-center gap-1"
                            >
                              <Plus className="w-4 h-4" />
                              Novo cliente
                            </button>
                          </div>

                          <input
                            value={customerQuery}
                            onChange={(e) => setCustomerQuery(e.target.value)}
                            placeholder="Buscar por nome/telefone/endereço..."
                            className="w-full border border-gray-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white rounded-lg px-3 py-2 text-sm"
                          />

                          <select
                            value={draftCustomerId}
                            onChange={(e) => {
                              setCustomerError(null);
                              setDraftCustomerId(e.target.value);
                            }}
                            className="w-full border border-gray-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white rounded-lg px-3 py-2 text-sm"
                          >
                            <option value="">Sem cliente</option>
                            {filteredCustomers.map((c) => (
                              <option key={c.id} value={c.id}>
                                {c.name} — {c.phone}
                              </option>
                            ))}
                          </select>

                          {draftCustomerId && (() => {
                            const sel = customers.find((c) => c.id === draftCustomerId);
                            if (!sel) return null;
                            return (
                              <div className="text-sm text-blue-900 dark:text-blue-200 space-y-1">
                                <div><span className="font-semibold">Nome:</span> {sel.name}</div>
                                <div><span className="font-semibold">Telefone:</span> {sel.phone}</div>
                                <div><span className="font-semibold">Endereço:</span> {sel.address}</div>
                              </div>
                            );
                          })()}

                          {customerError && (
                            <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 px-3 py-2 rounded-lg text-sm">
                              {customerError}
                            </div>
                          )}
                        </div>
                      )}

                      <div className="flex items-center justify-between gap-3 flex-wrap">
                        <div className="font-semibold text-gray-900 dark:text-white">Itens do pedido</div>
                        {editing && (
                          <button
                            onClick={addDraftItem}
                            className="px-3 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 flex items-center gap-2"
                          >
                            <Plus className="w-4 h-4" />
                            Adicionar item
                          </button>
                        )}
                      </div>

                      <div className="space-y-3">
                        {(editing ? draftItems : order.order_items).map((it: any) => {
                          const isDraft = editing;
                          const draft = it as DraftItem;
                          const real = it as OrderItem;

                          const productId = isDraft ? draft.product_id : real.product_id;
                          const qty = isDraft ? draft.quantity : real.quantity;
                          const prod = isDraft
                            ? products.find((p) => p.id === productId)
                            : real.products;

                          const itemSubtotal = !isDraft
                            ? Number(real.quantity || 0) * Number(real.unit_price || 0)
                            : 0;

                          return (
                            <div key={isDraft ? draft.id : real.id} className="bg-gray-50 dark:bg-slate-700/50 border border-gray-200 dark:border-slate-700 rounded-xl p-4">
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0 flex items-center gap-3">
                                  <Package className="w-5 h-5 text-gray-500" />
                                  <div className="min-w-0">
                                    {editing ? (
                                      <select
                                        value={productId}
                                        onChange={(e) => {
                                          const selectedProd = products.find((p) => p.id === e.target.value);
                                          updateDraftItem(draft.id, {
                                            product_id: e.target.value,
                                            unit_price: Number(selectedProd?.price || 0),
                                            unit_cost: Number(selectedProd?.cost_price || 0),
                                          });
                                        }}
                                        className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-full"
                                      >
                                        {products.map((p) => (
                                          <option key={p.id} value={p.id}>
                                            {p.name} (estoque: {p.stock_quantity})
                                          </option>
                                        ))}
                                      </select>
                                    ) : (
                                      <>
                                        <div className="font-semibold text-gray-900 dark:text-white truncate">
                                          {prod?.name}
                                        </div>
                                        {prod?.description && (
                                          <div className="text-sm text-gray-600 dark:text-slate-400 truncate">
                                            {prod.description}
                                          </div>
                                        )}
                                      </>
                                    )}
                                  </div>
                                </div>

                                {editing && (
                                  <button
                                    onClick={() => removeDraftItem(draft.id)}
                                    className="text-red-700 hover:text-red-900"
                                    title="Remover item"
                                  >
                                    <Trash2 className="w-5 h-5" />
                                  </button>
                                )}
                              </div>

                              <div className="mt-3 flex items-center justify-between">
                                <div className="text-sm text-gray-700 dark:text-slate-300">
                                  Estoque atual: <span className="font-semibold">{prod?.stock_quantity ?? '-'}</span>
                                </div>

                                <div className="flex items-center gap-2">
                                  {editing ? (
                                    <>
                                      <button
                                        onClick={() =>
                                          updateDraftItem(draft.id, {
                                            quantity: Math.max(1, qty - 1),
                                          })
                                        }
                                        className="bg-white dark:bg-slate-700 border border-gray-300 dark:border-slate-600 p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-600"
                                        title="-"
                                      >
                                        <Minus className="w-4 h-4" />
                                      </button>
                                      <input
                                        type="number"
                                        min={1}
                                        value={qty}
                                        onChange={(e) => {
                                          const v = Number(e.target.value);
                                          updateDraftItem(draft.id, {
                                            quantity: Number.isFinite(v) ? Math.max(1, v) : 1,
                                          });
                                        }}
                                        className="w-20 border border-gray-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white rounded-lg px-3 py-2 text-sm text-center"
                                      />
                                      <button
                                        onClick={() => updateDraftItem(draft.id, { quantity: qty + 1 })}
                                        className="bg-white dark:bg-slate-700 border border-gray-300 dark:border-slate-600 p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-600"
                                        title="+"
                                      >
                                        <Plus className="w-4 h-4" />
                                      </button>
                                    </>
                                  ) : (
                                    <div className="text-right">
                                      <div className="font-bold text-gray-900 dark:text-white">{qty} un.</div>
                                      <div className="text-sm text-green-700 dark:text-green-400 font-semibold">
                                        {formatBRL(itemSubtotal)}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      <div className="pt-2 space-y-2">
                        <div className="text-sm text-gray-700 dark:text-slate-300 flex items-center justify-between">
                          <span className="font-semibold">Total de itens:</span>
                          <span className="font-bold">
                            {(editing ? draftItems : order.order_items).reduce(
                              (sum: number, i: any) => sum + (i.quantity || 0),
                              0
                            )}
                          </span>
                        </div>

                        {!editing && (
                          <div className="text-sm text-gray-700 dark:text-slate-300 flex items-center justify-between">
                            <span className="font-semibold">Total do pedido:</span>
                            <span className="font-bold text-green-700 dark:text-green-400">
                              {formatBRL(orderTotal)}
                            </span>
                          </div>
                        )}
                      </div>

                      {editing && (
                        <div className="text-xs text-gray-500 dark:text-slate-400">
                          * Ao salvar, o sistema devolve o estoque antigo e aplica o novo para manter tudo correto.
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {showNewCustomer && (
        <div
          className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50"
          onClick={() => setShowNewCustomer(false)}
        >
          <div
            className="bg-white dark:bg-slate-800 w-full max-w-xl rounded-2xl shadow-xl border border-gray-200 dark:border-slate-700"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b dark:border-slate-700">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">Novo Cliente</h3>
              <button
                onClick={() => setShowNewCustomer(false)}
                className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700 dark:text-slate-300"
                title="Fechar"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="px-6 py-5 space-y-4">
              <div>
                <label className="text-sm text-gray-700 dark:text-slate-300">Nome</label>
                <input
                  value={newCustomerName}
                  onChange={(e) => setNewCustomerName(e.target.value)}
                  className="mt-1 w-full border border-gray-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white rounded-lg px-3 py-2"
                  placeholder="Ex: Leleko"
                />
              </div>

              <div>
                <label className="text-sm text-gray-700 dark:text-slate-300">Telefone</label>
                <input
                  value={newCustomerPhone}
                  onChange={(e) => setNewCustomerPhone(e.target.value)}
                  className="mt-1 w-full border border-gray-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white rounded-lg px-3 py-2"
                  placeholder="Ex: (71) 99999-9999"
                />
              </div>

              <div>
                <label className="text-sm text-gray-700 dark:text-slate-300">Endereço</label>
                <input
                  value={newCustomerAddress}
                  onChange={(e) => setNewCustomerAddress(e.target.value)}
                  className="mt-1 w-full border border-gray-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white rounded-lg px-3 py-2"
                  placeholder="Rua, número, bairro..."
                />
              </div>

              {customerError && (
                <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 px-4 py-3 rounded-lg text-sm">
                  {customerError}
                </div>
              )}
            </div>

            <div className="px-6 py-4 border-t dark:border-slate-700 flex items-center justify-end gap-3">
              <button
                onClick={() => setShowNewCustomer(false)}
                className="px-4 py-2 rounded-lg border border-gray-300 dark:border-slate-600 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700/50"
              >
                Cancelar
              </button>

              <button
                onClick={createCustomer}
                className="px-4 py-2 rounded-lg bg-blue-600 text-white font-semibold hover:bg-blue-700"
              >
                Salvar Cliente
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
