import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Product } from '../../types/database';
import { Plus, CreditCard as Edit2, Package, Trash2 } from 'lucide-react';

export function ProductManagement() {
  const [products, setProducts] = useState<Product[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    stock_quantity: 0,
    price: 0,
    cost_price: 0,
  });

  useEffect(() => {
    loadProducts();
  }, []);

  const loadProducts = async () => {
    try {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setProducts(data || []);
    } catch (error) {
      console.error('Error loading products:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      if (editingProduct) {
        const { error } = await supabase
          .from('products')
          .update(formData)
          .eq('id', editingProduct.id);

        if (error) throw error;
      } else {
        const { error } = await supabase.from('products').insert([formData]);

        if (error) throw error;
      }

      resetForm();
      loadProducts();
    } catch (error) {
      console.error('Error saving product:', error);
      alert('Não foi possível salvar o produto.');
    }
  };

  const handleDelete = async (productId: string) => {
    const confirmed = window.confirm('Deseja realmente excluir este produto?');
    if (!confirmed) return;

    try {
      const { error } = await supabase.from('products').delete().eq('id', productId);

      if (error) throw error;

      setProducts((prev) => prev.filter((product) => product.id !== productId));
    } catch (error) {
      console.error('Error deleting product:', error);
      alert('Não foi possível excluir o produto.');
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      stock_quantity: 0,
      price: 0,
      cost_price: 0,
    });
    setEditingProduct(null);
    setShowForm(false);
  };

  const handleEdit = (product: Product) => {
    setEditingProduct(product);
    setFormData({
      name: product.name,
      description: product.description || '',
      stock_quantity: product.stock_quantity || 0,
      price: product.price || 0,
      cost_price: product.cost_price || 0,
    });
    setShowForm(true);
  };

  const handleNewProduct = () => {
    setEditingProduct(null);
    setFormData({
      name: '',
      description: '',
      stock_quantity: 0,
      price: 0,
      cost_price: 0,
    });
    setShowForm(true);
  };

  const formatCurrency = (value: number) => {
    return Number(value || 0).toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    });
  };

  if (loading) {
    return <div className="text-center py-8">Carregando produtos...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">Produtos</h2>
        <button
          onClick={handleNewProduct}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition"
        >
          <Plus className="w-5 h-5" />
          Novo Produto
        </button>
      </div>

      {showForm && (
        <div className="bg-white p-6 rounded-xl shadow-md border border-gray-200">
          <h3 className="text-lg font-semibold mb-4">
            {editingProduct ? 'Editar Produto' : 'Novo Produto'}
          </h3>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nome do Produto
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Descrição
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Quantidade em Estoque
                </label>
                <input
                  type="number"
                  value={formData.stock_quantity}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      stock_quantity: parseInt(e.target.value) || 0,
                    })
                  }
                  min="0"
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Preço de Venda
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.price}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      price: Number(e.target.value) || 0,
                    })
                  }
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Preço de Custo
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.cost_price}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      cost_price: Number(e.target.value) || 0,
                    })
                  }
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>

            <div className="flex gap-2">
              <button
                type="submit"
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition"
              >
                {editingProduct ? 'Atualizar' : 'Criar'}
              </button>

              <button
                type="button"
                onClick={resetForm}
                className="bg-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-400 transition"
              >
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {products.map((product) => (
          <div
            key={product.id}
            className="bg-white p-5 rounded-xl shadow-md border border-gray-200 hover:shadow-lg transition"
          >
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-2">
                <Package className="w-5 h-5 text-blue-600" />
                <h3 className="font-semibold text-gray-900">{product.name}</h3>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleEdit(product)}
                  className="text-gray-500 hover:text-blue-600 transition"
                  title="Editar produto"
                >
                  <Edit2 className="w-4 h-4" />
                </button>

                <button
                  onClick={() => handleDelete(product.id)}
                  className="text-gray-500 hover:text-red-600 transition"
                  title="Excluir produto"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            {product.description && (
              <p className="text-sm text-gray-600 mb-3">{product.description}</p>
            )}

            <div className="space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Estoque:</span>
                <span
                  className={`font-semibold ${
                    product.stock_quantity > 0 ? 'text-green-600' : 'text-red-600'
                  }`}
                >
                  {product.stock_quantity} un.
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-gray-600">Preço de venda:</span>
                <span className="font-semibold text-gray-900">
                  {formatCurrency(product.price || 0)}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-gray-600">Preço de custo:</span>
                <span className="font-semibold text-gray-900">
                  {formatCurrency(product.cost_price || 0)}
                </span>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                <span className="text-gray-600">Lucro unitário:</span>
                <span className="font-semibold text-green-600">
                  {formatCurrency((product.price || 0) - (product.cost_price || 0))}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {products.length === 0 && (
        <div className="text-center py-12 bg-gray-50 rounded-xl">
          <Package className="w-12 h-12 text-gray-400 mx-auto mb-3" />
          <p className="text-gray-600">Nenhum produto cadastrado ainda</p>
        </div>
      )}
    </div>
  );
}