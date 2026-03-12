import { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { ProductManagement } from './ProductManagement';
import { OrderCreation } from './OrderCreation';
import { CustomerCreation } from './CustomerCreation';
import { OrderManagement } from './OrderManagement';
import { CashierDashboard } from './CashierDashboard';
import {
  Package,
  ShoppingCart,
  LogOut,
  Users,
  ClipboardList,
  DollarSign,
} from 'lucide-react';

export function AdminDashboard() {
  const { profile, signOut } = useAuth();
  const [activeTab, setActiveTab] = useState<
    'products' | 'orders' | 'customers' | 'manageOrders' | 'cashier'
  >('products');

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Dashboard Administrativo</h1>
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
        <div className="mb-6">
          <nav className="flex gap-2 flex-wrap">
            <button
              onClick={() => setActiveTab('products')}
              className={`flex items-center gap-2 px-6 py-3 rounded-lg font-medium transition ${
                activeTab === 'products'
                  ? 'bg-blue-600 text-white shadow-lg'
                  : 'bg-white text-gray-700 hover:bg-gray-100'
              }`}
            >
              <Package className="w-5 h-5" />
              Produtos
            </button>

            <button
              onClick={() => setActiveTab('orders')}
              className={`flex items-center gap-2 px-6 py-3 rounded-lg font-medium transition ${
                activeTab === 'orders'
                  ? 'bg-blue-600 text-white shadow-lg'
                  : 'bg-white text-gray-700 hover:bg-gray-100'
              }`}
            >
              <ShoppingCart className="w-5 h-5" />
              Criar Pedido
            </button>

            <button
              onClick={() => setActiveTab('manageOrders')}
              className={`flex items-center gap-2 px-6 py-3 rounded-lg font-medium transition ${
                activeTab === 'manageOrders'
                  ? 'bg-blue-600 text-white shadow-lg'
                  : 'bg-white text-gray-700 hover:bg-gray-100'
              }`}
            >
              <ClipboardList className="w-5 h-5" />
              Gerenciar Pedidos
            </button>

            <button
              onClick={() => setActiveTab('customers')}
              className={`flex items-center gap-2 px-6 py-3 rounded-lg font-medium transition ${
                activeTab === 'customers'
                  ? 'bg-blue-600 text-white shadow-lg'
                  : 'bg-white text-gray-700 hover:bg-gray-100'
              }`}
            >
              <Users className="w-5 h-5" />
              Clientes
            </button>

            <button
              onClick={() => setActiveTab('cashier')}
              className={`flex items-center gap-2 px-6 py-3 rounded-lg font-medium transition ${
                activeTab === 'cashier'
                  ? 'bg-blue-600 text-white shadow-lg'
                  : 'bg-white text-gray-700 hover:bg-gray-100'
              }`}
            >
              <DollarSign className="w-5 h-5" />
              Caixa
            </button>
          </nav>
        </div>

        <div className="bg-gray-50 rounded-xl">
          {activeTab === 'products' && <ProductManagement />}
          {activeTab === 'orders' && <OrderCreation />}
          {activeTab === 'manageOrders' && <OrderManagement />}
          {activeTab === 'customers' && <CustomerCreation />}
          {activeTab === 'cashier' && <CashierDashboard />}
        </div>
      </div>
    </div>
  );
}