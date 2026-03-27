import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';
import type { Customer } from '../../types/database';
import { Users, Plus, Trash2, Search, Edit2, X } from 'lucide-react';

export function CustomerManagement() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');

  const [query, setQuery] = useState('');
  const [message, setMessage] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const phoneNorm = (v: string) => v.replace(/\D/g, '');

  const resetForm = () => {
    setName('');
    setPhone('');
    setAddress('');
    setEditingCustomer(null);
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return customers;

    const qPhone = phoneNorm(q);

    return customers.filter((c) => {
      const customerName = (c.name || '').toLowerCase();
      const customerAddress = (c.address || '').toLowerCase();
      const customerPhone = phoneNorm(c.phone || '');

      return (
        customerName.includes(q) ||
        customerAddress.includes(q) ||
        (qPhone && customerPhone.includes(qPhone))
      );
    });
  }, [customers, query]);

  async function loadCustomers() {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setCustomers((data || []) as Customer[]);
    } catch (e) {
      console.error(e);
      setMessage({ type: 'err', text: 'Erro ao carregar clientes.' });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadCustomers();
  }, []);

  function handleEdit(customer: Customer) {
    setEditingCustomer(customer);
    setName(customer.name || '');
    setPhone(customer.phone || '');
    setAddress(customer.address || '');
    setMessage(null);
  }

  async function saveCustomer() {
    setMessage(null);

    const n = name.trim();
    const p = phoneNorm(phone);
    const a = address.trim();

    if (!n || !p || !a) {
      setMessage({ type: 'err', text: 'Preencha Nome, Telefone e Endereço.' });
      return;
    }

    setSaving(true);
    try {
      const { data: existing, error: existingError } = await supabase
        .from('customers')
        .select('id')
        .eq('phone', p)
        .maybeSingle();

      if (existingError) throw existingError;

      if (existing?.id && existing.id !== editingCustomer?.id) {
        setMessage({ type: 'err', text: 'Já existe um cliente com esse telefone.' });
        return;
      }

      if (editingCustomer) {
        const { error } = await supabase
          .from('customers')
          .update({
            name: n,
            phone: p,
            address: a,
          })
          .eq('id', editingCustomer.id);

        if (error) throw error;

        setMessage({ type: 'ok', text: 'Cliente atualizado com sucesso!' });
      } else {
        const { error } = await supabase
          .from('customers')
          .insert([{ name: n, phone: p, address: a }]);

        if (error) throw error;

        setMessage({ type: 'ok', text: 'Cliente cadastrado com sucesso!' });
      }

      resetForm();
      await loadCustomers();
    } catch (e) {
      console.error(e);
      setMessage({
        type: 'err',
        text: editingCustomer
          ? 'Erro ao atualizar cliente (confira RLS/policies).'
          : 'Erro ao cadastrar cliente (confira RLS/policies).',
      });
    } finally {
      setSaving(false);
    }
  }

  async function deleteCustomer(id: string) {
    setMessage(null);

    const ok = window.confirm('Deseja realmente remover este cliente?');
    if (!ok) return;

    try {
      const { error } = await supabase.from('customers').delete().eq('id', id);
      if (error) throw error;

      setCustomers((prev) => prev.filter((c) => c.id !== id));

      if (editingCustomer?.id === id) {
        resetForm();
      }

      setMessage({ type: 'ok', text: 'Cliente removido.' });
    } catch (e) {
      console.error(e);
      setMessage({ type: 'err', text: 'Erro ao remover cliente.' });
    }
  }

  if (loading) {
    return <div className="text-center py-8">Carregando clientes...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Users className="w-6 h-6 text-blue-600" />
        <h2 className="text-2xl font-bold text-gray-900">Cadastro de Clientes</h2>
      </div>

      <div className="bg-white p-6 rounded-xl shadow-md border border-gray-200">
        <div className="flex items-center justify-between gap-3 mb-4">
          <h3 className="font-semibold text-gray-900">
            {editingCustomer ? 'Editar cliente' : 'Novo cliente'}
          </h3>

          {editingCustomer && (
            <button
              onClick={resetForm}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-300 hover:bg-gray-50 text-sm"
            >
              <X className="w-4 h-4" />
              Cancelar edição
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="text-sm text-gray-700">Nome</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2"
              placeholder="Ex: Leleko"
            />
          </div>

          <div>
            <label className="text-sm text-gray-700">Telefone</label>
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2"
              placeholder="Ex: (71) 99999-9999"
            />
          </div>

          <div>
            <label className="text-sm text-gray-700">Endereço</label>
            <input
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2"
              placeholder="Rua, número, bairro..."
            />
          </div>
        </div>

        <button
          onClick={saveCustomer}
          disabled={saving}
          className="mt-4 bg-green-600 text-white px-4 py-2 rounded-lg font-semibold hover:bg-green-700 transition disabled:opacity-50 flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          {saving
            ? 'Salvando...'
            : editingCustomer
            ? 'Atualizar cliente'
            : 'Cadastrar'}
        </button>

        {message && (
          <div
            className={`mt-4 px-4 py-3 rounded-lg text-sm border ${
              message.type === 'ok'
                ? 'bg-green-50 border-green-200 text-green-700'
                : 'bg-red-50 border-red-200 text-red-700'
            }`}
          >
            {message.text}
          </div>
        )}
      </div>

      <div className="bg-white p-6 rounded-xl shadow-md border border-gray-200">
        <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
          <h3 className="font-semibold text-gray-900">Clientes cadastrados</h3>

          <div className="flex items-center gap-2 border border-gray-300 rounded-lg px-3 py-2">
            <Search className="w-4 h-4 text-gray-500" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="outline-none text-sm w-64 max-w-full"
              placeholder="Buscar por nome/telefone/endereço..."
            />
          </div>
        </div>

        {filtered.length === 0 ? (
          <p className="text-gray-600">Nenhum cliente encontrado.</p>
        ) : (
          <div className="space-y-3">
            {filtered.map((c) => (
              <div
                key={c.id}
                className="bg-gray-50 p-4 rounded-lg flex items-start justify-between gap-4"
              >
                <div>
                  <p className="font-semibold text-gray-900">{c.name}</p>
                  <p className="text-sm text-gray-700">Telefone: {c.phone}</p>
                  <p className="text-sm text-gray-700">Endereço: {c.address}</p>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    onClick={() => handleEdit(c)}
                    className="text-blue-600 hover:text-blue-800 transition"
                    title="Editar"
                  >
                    <Edit2 className="w-5 h-5" />
                  </button>

                  <button
                    onClick={() => deleteCustomer(c.id)}
                    className="text-red-600 hover:text-red-800 transition"
                    title="Remover"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
