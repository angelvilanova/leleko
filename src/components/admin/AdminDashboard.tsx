import { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { ProductManagement } from './ProductManagement';
import { OrderCreation } from './OrderCreation';
import { CustomerCreation } from './CustomerCreation';
import { OrderManagement } from './OrderManagement';
import { CashierDashboard } from './CashierDashboard';
import { CustomerHistory } from './CustomerHistory';
import {
  Package,
  ShoppingCart,
  LogOut,
  Users,
  ClipboardList,
  DollarSign,
  History,
  Menu,
  X,
  LayoutDashboard,
} from 'lucide-react';

type Tab = 'products' | 'orders' | 'customers' | 'manageOrders' | 'cashier' | 'customerHistory';

const navItems: { id: Tab; label: string; icon: typeof Package }[] = [
  { id: 'products', label: 'Produtos', icon: Package },
  { id: 'orders', label: 'Criar Pedido', icon: ShoppingCart },
  { id: 'manageOrders', label: 'Pedidos', icon: ClipboardList },
  { id: 'customers', label: 'Clientes', icon: Users },
  { id: 'customerHistory', label: 'Histórico', icon: History },
  { id: 'cashier', label: 'Caixa', icon: DollarSign },
];

export function AdminDashboard() {
  const { profile, signOut } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>('products');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const currentNav = navItems.find((n) => n.id === activeTab);

  function handleNav(tab: Tab) {
    setActiveTab(tab);
    setSidebarOpen(false);
  }

  return (
    <div className="min-h-screen bg-slate-100 flex">
      {/* Overlay mobile */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed inset-y-0 left-0 z-40 w-64 bg-gradient-to-b from-slate-900 to-slate-800
          flex flex-col transition-transform duration-300 ease-in-out
          lg:translate-x-0 lg:static lg:z-auto
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        {/* Logo */}
        <div className="flex items-center gap-3 px-6 h-16 border-b border-white/10">
          <div className="w-9 h-9 rounded-lg bg-blue-500 flex items-center justify-center shadow-lg shadow-blue-500/30">
            <LayoutDashboard className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-white tracking-wide">Leleko</h1>
            <p className="text-[10px] text-slate-400 -mt-0.5 uppercase tracking-widest">Sistema de Gestão</p>
          </div>
          <button
            onClick={() => setSidebarOpen(false)}
            className="ml-auto text-slate-400 hover:text-white lg:hidden"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => handleNav(item.id)}
                className={`
                  w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all
                  ${
                    isActive
                      ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30'
                      : 'text-slate-300 hover:bg-white/10 hover:text-white'
                  }
                `}
              >
                <Icon className="w-5 h-5 shrink-0" />
                {item.label}
              </button>
            );
          })}
        </nav>

        {/* User footer */}
        <div className="px-4 py-4 border-t border-white/10">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-full bg-blue-500/20 border border-blue-400/30 flex items-center justify-center">
              <span className="text-sm font-bold text-blue-400">
                {(profile?.email || 'A')[0].toUpperCase()}
              </span>
            </div>
            <div className="min-w-0">
              <p className="text-sm text-white font-medium truncate">{profile?.email}</p>
              <p className="text-[10px] text-slate-400 uppercase tracking-wider">Administrador</p>
            </div>
          </div>
          <button
            onClick={signOut}
            className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-sm font-medium text-slate-300 hover:bg-red-500/20 hover:text-red-400 transition-all"
          >
            <LogOut className="w-4 h-4" />
            Sair do sistema
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top header */}
        <header className="h-16 bg-white border-b border-slate-200 flex items-center px-4 sm:px-6 lg:px-8 gap-4 sticky top-0 z-20 shadow-sm">
          <button
            onClick={() => setSidebarOpen(true)}
            className="text-slate-600 hover:text-slate-900 lg:hidden"
          >
            <Menu className="w-6 h-6" />
          </button>

          <div className="flex items-center gap-3 min-w-0">
            {currentNav && (
              <>
                <currentNav.icon className="w-5 h-5 text-blue-600 shrink-0" />
                <h2 className="text-lg font-bold text-slate-900 truncate">{currentNav.label}</h2>
              </>
            )}
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto">
          {activeTab === 'products' && <ProductManagement />}
          {activeTab === 'orders' && <OrderCreation />}
          {activeTab === 'manageOrders' && <OrderManagement />}
          {activeTab === 'customers' && <CustomerCreation />}
          {activeTab === 'customerHistory' && <CustomerHistory />}
          {activeTab === 'cashier' && <CashierDashboard />}
        </main>
      </div>
    </div>
  );
}
