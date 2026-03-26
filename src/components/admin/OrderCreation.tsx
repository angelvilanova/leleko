import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Product, CartItem } from '../../types/database';
import { useAuth } from '../../contexts/AuthContext';
import {
  ShoppingCart,
  Plus,
  Minus,
  Trash2,
  Package,
  CheckCircle,
  Users,
  X,
} from 'lucide-react';

type Customer = {
  id: string;
  name: string;
  phone: string;
  address: string;
  created_at?: string;
};

export function OrderCreation() {
  const { profile } = useAuth();

  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [customerQuery, setCustomerQuery] = useState('');
  const [showNewCustomer, setShowNewCustomer] = useState(false);

  const [newCustomerName, setNewCustomerName] = useState('');
  const [newCustomerPhone, setNewCustomerPhone] = useState('');
  const [newCustomerAddress, setNewCustomerAddress] = useState('');

  const [customerError, setCustomerError] = useState<string | null>(null);

  const [productQuery, setProductQuery] = useState('');

  const normalizePhone = (v: string) => v.replace(/\D/g, '');

  const formatCurrency = (value: number) =>
    Number(value || 0).toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    });

  useEffect(() => {
    loadProducts();
    loadCustomers();
  }, []);

  const loadProducts = async () => {
    try {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .gt('stock_quantity', 0)
        .order('name');

      if (error) throw error;
      setProducts(data || []);
    } catch (error) {
      console.error('Error loading products:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadCustomers = async () => {
    try {
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .order('name');

      if (error) throw error;
      setCustomers((data || []) as Customer[]);
    } catch (error) {
      console.error('Error loading customers:', error);
    }
  };

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

  const filteredProducts = useMemo(() => {
    const q = productQuery.trim().toLowerCase();
    if (!q) return products;

    return products.filter((product) => {
      const name = product.name?.toLowerCase() || '';
      const description = product.description?.toLowerCase() || '';

      return name.includes(q) || description.includes(q);
    });
  }, [products, productQuery]);

  const addToCart = (product: Product) => {
    const existingItem = cart.find((item) => item.product.id === product.id);

    if (existingItem) {
      if (existingItem.quantity < product.stock_quantity) {
        setCart(
          cart.map((item) =>
            item.product.id === product.id
              ? { ...item, quantity: item.quantity + 1 }
              : item
          )
        );
      }
    } else {
      setCart([
        ...cart,
        {
          product,
          quantity: 1,
          unit_price: Number(product.price || 0),
        },
      ]);
    }
  };

  const updateQuantity = (productId: string, delta: number) => {
    setCart(
      cart
        .map((item) => {
          if (item.product.id === productId) {
            const newQuantity = item.quantity + delta;

            return {
              ...item,
              quantity: Math.max(
                0,
                Math.min(newQuantity, item.product.stock_quantity)
              ),
            };
          }

          return item;
        })
        .filter((item) => item.quantity > 0)
    );
  };

  const updateUnitPrice = (productId: string, value: string) => {
    const parsed = Number(value);

    setCart((prev) =>
      prev.map((item) =>
        item.product.id === productId
          ? {
              ...item,
              unit_price: Number.isFinite(parsed) ? Math.max(0, parsed) : 0,
            }
          : item
      )
    );
  };

  const removeFromCart = (productId: string) => {
    setCart(cart.filter((item) => item.product.id !== productId));
  };

  const generateOrderNumber = () => {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const random = Math.floor(Math.random() * 10000)
      .toString()
      .padStart(4, '0');

    return `PED-${year}${month}${day}-${random}`;
  };

  const createCustomer = async () => {
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
        setSelectedCustomerId(existing.id);
        setShowNewCustomer(false);
        setCustomerError(
          'Já existe um cliente com esse telefone. Selecionei ele pra você.'
        );
        return;
      }

      const { data, error } = await supabase
        .from('customers')
        .insert([{ name, phone, address }])
        .select('*')
        .single();

      if (error) throw error;

      const created = data as Customer;

      setCustomers((prev) =>
        [...prev, created].sort((a, b) => a.name.localeCompare(b.name))
      );

      setSelectedCustomerId(created.id);
      setShowNewCustomer(false);
      setNewCustomerName('');
      setNewCustomerPhone('');
      setNewCustomerAddress('');
      setCustomerError(null);
    } catch (error) {
      console.error('Error creating customer:', error);
      setCustomerError(
        'Erro ao cadastrar cliente. Verifique as policies (RLS) no Supabase.'
      );
    }
  };

  const createOrder = async () => {
    if (cart.length === 0 || !profile) return;

    if (!selectedCustomerId) {
      setCustomerError(
        'Selecione um cliente (ou crie um novo) antes de criar o pedido.'
      );
      return;
    }

    const anyZeroPrice = cart.some(
      (item) => !item.unit_price || item.unit_price <= 0
    );

    if (anyZeroPrice) {
      setCustomerError(
        'Existe item no carrinho sem preço de venda válido.'
      );
      return;
    }

    const anyNegativeCost = cart.some(
      (item) => Number(item.product.cost_price || 0) < 0
    );

    if (anyNegativeCost) {
      setCustomerError('Existe produto com preço de custo inválido.');
      return;
    }

    setSubmitting(true);
    setCustomerError(null);

    try {
      const orderNumber = generateOrderNumber();

      const { data: order, error: orderError } = await supabase
        .from('orders')
        .insert([
          {
            order_number: orderNumber,
            status: 'pending',
            created_by: profile.id,
            customer_id: selectedCustomerId,
          },
        ])
        .select()
        .single();

      if (orderError) throw orderError;

      const orderItems = cart.map((item) => ({
        order_id: order.id,
        product_id: item.product.id,
        quantity: item.quantity,
        unit_price: Number(item.unit_price || 0),
        unit_cost: Number(item.product.cost_price || 0),
      }));

      const { error: itemsError } = await supabase
        .from('order_items')
        .insert(orderItems);

      if (itemsError) throw itemsError;

      for (const item of cart) {
        const { error: updateError } = await supabase
          .from('products')
          .update({
            stock_quantity: item.product.stock_quantity - item.quantity,
          })
          .eq('id', item.product.id);

        if (updateError) throw updateError;
      }

      setCart([]);
      setSelectedCustomerId('');
      setCustomerQuery('');
      setCustomerError(null);
      setProductQuery('');
      setSuccess(true);

      setTimeout(() => setSuccess(false), 3000);

      loadProducts();
      loadCustomers();
    } catch (error) {
      console.error('Error creating order:', error);
      setCustomerError('Não foi possível criar o pedido.');
    } finally {
      setSubmitting(false);
    }
  };

  const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);

  const totalValue = cart.reduce(
    (sum, item) => sum + item.quantity * Number(item.unit_price ?? 0),
    0
  );

  if (loading) {
    return <div className="text-center py-8">Carregando produtos...</div>;
  }

  const selectedCustomer = customers.find((c) => c.id === selectedCustomerId);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2 space-y-4">
        <div className="space-y-3">
          <h2 className="text-2xl font-bold text-gray-900">Produtos Disponíveis</h2>

          <input
            value={productQuery}
            onChange={(e) => setProductQuery(e.target.value)}
            placeholder="Buscar produto por nome ou descrição..."
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredProducts.map((product) => {
            const inCart = cart.find((item) => item.product.id === product.id);
            const availableStock = product.stock_quantity - (inCart?.quantity || 0);

            return (
              <div
                key={product.id}
                className="bg-white p-4 rounded-xl shadow-md border border-gray-200 hover:shadow-lg transition"
              >
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <h3 className="font-semibold text-gray-900">{product.name}</h3>

                    {product.description && (
                      <p className="text-sm text-gray-600 mt-1">{product.description}</p>
                    )}

                    <p className="text-sm text-gray-700 mt-1">
                      Preço padrão:{' '}
                      <span className="font-semibold">
                        {formatCurrency(product.price ?? 0)}
                      </span>
                    </p>

                    <p className="text-xs text-gray-500 mt-1">
                      Custo: {formatCurrency(product.cost_price ?? 0)}
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-between mt-3">
                  <span className="text-sm text-gray-600">
                    Disponível: <span className="font-semibold">{availableStock}</span>
                  </span>

                  <button
                    onClick={() => addToCart(product)}
                    disabled={availableStock === 0}
                    className="bg-blue-600 text-white p-2 rounded-lg hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {filteredProducts.length === 0 && (
          <div className="text-center py-12 bg-gray-50 rounded-xl">
            <Package className="w-12 h-12 text-gray-400 mx-auto mb-3" />
            <p className="text-gray-600">
              {products.length === 0
                ? 'Nenhum produto disponível em estoque'
                : 'Nenhum produto encontrado para essa busca'}
            </p>
          </div>
        )}
      </div>

      <div className="lg:col-span-1">
        <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-200 sticky top-6">
          <div className="flex items-center gap-2 mb-4">
            <ShoppingCart className="w-6 h-6 text-blue-600" />
            <h2 className="text-xl font-bold text-gray-900">Carrinho</h2>
          </div>

          <div className="mb-5 bg-gray-50 border border-gray-200 rounded-xl p-4">
            <div className="flex items-center justify-between gap-2 mb-3">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-blue-600" />
                <h3 className="font-semibold text-gray-900">Cliente</h3>
              </div>

              <button
                onClick={() => {
                  setCustomerError(null);
                  setShowNewCustomer(true);
                }}
                className="text-sm bg-green-600 text-white px-3 py-2 rounded-lg hover:bg-green-700 transition"
              >
                Novo
              </button>
            </div>

            <input
              value={customerQuery}
              onChange={(e) => setCustomerQuery(e.target.value)}
              placeholder="Buscar por nome/telefone/endereço..."
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mb-3"
            />

            <select
              value={selectedCustomerId}
              onChange={(e) => {
                setCustomerError(null);
                setSelectedCustomerId(e.target.value);
              }}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
            >
              <option value="">Selecione um cliente</option>
              {filteredCustomers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} — {c.phone}
                </option>
              ))}
            </select>

            {selectedCustomer && (
              <div className="mt-3 text-sm text-gray-700 space-y-1">
                <p>
                  <span className="font-semibold">Nome:</span> {selectedCustomer.name}
                </p>
                <p>
                  <span className="font-semibold">Telefone:</span> {selectedCustomer.phone}
                </p>
                <p>
                  <span className="font-semibold">Endereço:</span> {selectedCustomer.address}
                </p>
              </div>
            )}

            {customerError && (
              <div className="mt-3 bg-yellow-50 border border-yellow-200 text-yellow-800 px-3 py-2 rounded-lg text-sm">
                {customerError}
              </div>
            )}
          </div>

          {cart.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <ShoppingCart className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>Carrinho vazio</p>
            </div>
          ) : (
            <>
              <div className="space-y-3 mb-6 max-h-96 overflow-y-auto">
                {cart.map((item) => (
                  <div key={item.product.id} className="bg-gray-50 p-3 rounded-lg">
                    <div className="flex items-start justify-between mb-2">
                      <div className="min-w-0">
                        <h4 className="font-medium text-gray-900 text-sm">
                          {item.product.name}
                        </h4>

                        <p className="text-xs text-gray-500 mt-1">
                          Preço padrão: {formatCurrency(item.product.price ?? 0)}
                        </p>

                        <div className="mt-2">
                          <label className="block text-xs text-gray-600 mb-1">
                            Preço aplicado no pedido
                          </label>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={item.unit_price}
                            onChange={(e) =>
                              updateUnitPrice(item.product.id, e.target.value)
                            }
                            className="w-28 border border-gray-300 rounded px-2 py-1 text-sm"
                          />
                        </div>
                      </div>

                      <button
                        onClick={() => removeFromCart(item.product.id)}
                        className="text-red-500 hover:text-red-700"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="flex items-center justify-between mt-3">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => updateQuantity(item.product.id, -1)}
                          className="bg-white border border-gray-300 p-1 rounded hover:bg-gray-100"
                        >
                          <Minus className="w-3 h-3" />
                        </button>

                        <span className="font-semibold text-gray-900 min-w-[2rem] text-center">
                          {item.quantity}
                        </span>

                        <button
                          onClick={() => updateQuantity(item.product.id, 1)}
                          disabled={item.quantity >= item.product.stock_quantity}
                          className="bg-white border border-gray-300 p-1 rounded hover:bg-gray-100 disabled:opacity-50"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>

                      <span className="text-sm font-semibold text-gray-900">
                        {formatCurrency(item.quantity * Number(item.unit_price ?? 0))}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              <div className="border-t pt-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-gray-700">Total de itens:</span>
                  <span className="font-bold text-lg text-gray-900">{totalItems}</span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-gray-700">Total (estimado):</span>
                  <span className="font-bold text-lg text-gray-900">
                    {formatCurrency(totalValue)}
                  </span>
                </div>

                <button
                  onClick={createOrder}
                  disabled={submitting || !selectedCustomerId}
                  className="w-full bg-green-600 text-white py-3 rounded-lg font-semibold hover:bg-green-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {submitting ? (
                    'Criando Pedido...'
                  ) : (
                    <>
                      <CheckCircle className="w-5 h-5" />
                      Criar Pedido
                    </>
                  )}
                </button>
              </div>
            </>
          )}

          {success && (
            <div className="mt-4 bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg text-sm">
              Pedido criado com sucesso!
            </div>
          )}
        </div>
      </div>

      {showNewCustomer && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white w-full max-w-xl rounded-2xl shadow-xl border border-gray-200">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h3 className="text-lg font-bold text-gray-900">Novo Cliente</h3>
              <button
                onClick={() => setShowNewCustomer(false)}
                className="p-2 rounded-lg hover:bg-gray-100"
                title="Fechar"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="px-6 py-5 space-y-4">
              <div>
                <label className="text-sm text-gray-700">Nome</label>
                <input
                  value={newCustomerName}
                  onChange={(e) => setNewCustomerName(e.target.value)}
                  className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2"
                  placeholder="Ex: Leleko"
                />
              </div>

              <div>
                <label className="text-sm text-gray-700">Telefone</label>
                <input
                  value={newCustomerPhone}
                  onChange={(e) => setNewCustomerPhone(e.target.value)}
                  className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2"
                  placeholder="Ex: (71) 99999-9999"
                />
              </div>

              <div>
                <label className="text-sm text-gray-700">Endereço</label>
                <input
                  value={newCustomerAddress}
                  onChange={(e) => setNewCustomerAddress(e.target.value)}
                  className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2"
                  placeholder="Rua, número, bairro..."
                />
              </div>

              {customerError && (
                <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 px-4 py-3 rounded-lg text-sm">
                  {customerError}
                </div>
              )}
            </div>

            <div className="px-6 py-4 border-t flex items-center justify-end gap-3">
              <button
                onClick={() => setShowNewCustomer(false)}
                className="px-4 py-2 rounded-lg border border-gray-300 hover:bg-gray-50"
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
