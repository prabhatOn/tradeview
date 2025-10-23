"use client"

import { useState, FC, ReactNode } from "react"
import { useSidebarCollapsed } from '@/hooks/use-sidebar-collapsed'
import { TradingSidebar } from "@/components/trading-sidebar"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
 
import { Switch } from "@/components/ui/switch"
import {
  
  Shield,
  Bell,
  Palette,
  Code,
  Save,
  Moon,
  Sun,
  Sparkles,
  FileText,
  Building2
} from "lucide-react"
import { Toaster } from '@/components/ui/toaster'
import { useToast } from '@/hooks/use-toast'
import KycDocuments from "@/components/settings/kyc-documents"
import BankDetailsList from "@/components/settings/bank-details-list"
import ChangePasswordForm from "@/components/settings/change-password-form"

type SettingsSection = 'account' | 'security' | 'kyc' | 'bank';

// --- REUSABLE COMPONENTS ---
const SettingsCard: FC<{ title: string; description: string; children: ReactNode }> = ({ title, description, children }) => (
  <Card className="border-border/80">
    <div className="p-6 border-b border-border/50">
      <h3 className="text-lg font-semibold">{title}</h3>
      <p className="text-sm text-muted-foreground mt-1">{description}</p>
    </div>
    <div className="p-6 space-y-6">
      {children}
    </div>
  </Card>
);

const SettingsNavItem: FC<{
  icon: ReactNode;
  label: string;
  isActive: boolean;
  onClick: () => void;
}> = ({ icon, label, isActive, onClick }) => (
  <button
    onClick={onClick}
    className={`w-auto lg:w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
      isActive
        ? 'bg-primary/10 text-primary'
        : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
    }`}
  >
    {icon}
    {label}
  </button>
);

// --- SETTINGS SECTION COMPONENTS ---

const SecuritySettings = () => (
    <div className="space-y-6">
        <SettingsCard title="Security Settings" description="Manage your account security features.">
            <div className="flex items-center justify-between p-4 rounded-md bg-muted/30">
                <div>
                    <h4 className="font-medium">Two-Factor Authentication (2FA)</h4>
                    <p className="text-sm text-muted-foreground">Add an extra layer of security to your account.</p>
                </div>
                <Switch defaultChecked />
            </div>
            <div className="flex items-center justify-between p-4 rounded-md bg-muted/30">
                <div>
                    <h4 className="font-medium">Email Notifications on Login</h4>
                    <p className="text-sm text-muted-foreground">Receive security alerts via email for new logins.</p>
                </div>
                <Switch defaultChecked />
            </div>
        </SettingsCard>
        <ChangePasswordForm />
    </div>
);

const NotificationSettings = () => (
    <SettingsCard title="Notification Preferences" description="Choose how you want to be notified.">
         <div className="flex items-center justify-between p-4 rounded-md bg-muted/30">
            <div>
                <h4 className="font-medium">Trade Alerts</h4>
                <p className="text-sm text-muted-foreground">Get notified when trades are executed.</p>
            </div>
            <Switch defaultChecked />
        </div>
        <div className="flex items-center justify-between p-4 rounded-md bg-muted/30">
            <div>
                <h4 className="font-medium">Deposit & Withdrawal Updates</h4>
                <p className="text-sm text-muted-foreground">Receive notifications for fund movements.</p>
            </div>
            <Switch />
        </div>
    </SettingsCard>
);

const AppearanceSettings = () => {
    const [theme, setTheme] = useState('dark');
    return (
        <SettingsCard title="Appearance Settings" description="Customize the look and feel of your interface.">
            <h4 className="font-medium">Theme Selection</h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <button onClick={() => setTheme('dark')} className={`p-4 rounded-lg border-2 text-left transition-colors ${theme === 'dark' ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'}`}>
                    <Moon className="mb-2" />
                    <h5 className="font-semibold">Venta Black</h5>
                    <p className="text-xs text-muted-foreground">Original dark theme with Venta black background.</p>
                </button>
                <button onClick={() => setTheme('light')} className={`p-4 rounded-lg border-2 text-left transition-colors ${theme === 'light' ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'}`}>
                    <Sun className="mb-2" />
                    <h5 className="font-semibold">Bright White</h5>
                    <p className="text-xs text-muted-foreground">Full white mode for a bright, clean interface.</p>
                </button>
                 <button onClick={() => setTheme('colorful')} className={`p-4 rounded-lg border-2 text-left transition-colors ${theme === 'colorful' ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'}`}>
                    <Sparkles className="mb-2" />
                    <h5 className="font-semibold">Colorful Mode</h5>
                    <p className="text-xs text-muted-foreground">A bright and colorful interface experience.</p>
                </button>
            </div>
        </SettingsCard>
    );
};

const ApiSettings = () => (
    <SettingsCard title="API Access Management" description="Manage your API keys and access permissions.">
        <div className="p-4 rounded-md bg-muted/30 flex items-center justify-between">
            <div>
                <h4 className="font-medium">API Key Status</h4>
                <p className="text-sm text-muted-foreground">Your current API key is active.</p>
            </div>
            <Button variant="outline">Generate New Key</Button>
        </div>
        <div>
            <h4 className="font-medium mb-2">API Permissions</h4>
            <div className="space-y-4">
                <div className="flex items-center justify-between"><p>Read Access</p><Switch defaultChecked /></div>
                <div className="flex items-center justify-between"><p>Trade Access</p><Switch /></div>
                <div className="flex items-center justify-between"><p>Withdraw Access</p><Switch disabled /></div>
            </div>
        </div>
    </SettingsCard>
);

const KycSettings = () => {
    return <KycDocuments />;
};

const BankSettings = () => {
    return <BankDetailsList />;
};


// --- MAIN PAGE COMPONENT ---
export default function SettingsPage() {
  const [sidebarCollapsed, setSidebarCollapsed] = useSidebarCollapsed(false);
  const [activeSection, setActiveSection] = useState<SettingsSection>('security');
  const { toast } = useToast();

  const renderContent = () => {
    switch (activeSection) {
      case 'kyc': return <KycSettings />;
      case 'bank': return <BankSettings />;
      case 'security': return <SecuritySettings />;
      default: return <SecuritySettings />;
    }
  };

  const navItems = [
    { id: 'kyc', label: 'KYC Verification', icon: <FileText size={18} /> },
    { id: 'bank', label: 'Bank Details', icon: <Building2 size={18} /> },
    { id: 'security', label: 'Security', icon: <Shield size={18} /> },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <div className="flex flex-1 overflow-hidden">
        <TradingSidebar collapsed={sidebarCollapsed} onCollapsedChange={setSidebarCollapsed} />

        <main className={`flex-1 flex flex-col gap-6 overflow-auto transition-all duration-300 w-full p-4 sm:p-6 pb-28 sm:pb-6 ${sidebarCollapsed ? "sm:pl-20 pl-4" : "sm:pl-68 pl-4"}`}>
          {/* Header */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="w-full text-center sm:text-left">
              <h1 className="text-2xl font-bold">Settings</h1>
              <p className="text-muted-foreground">Manage your account preferences and security settings.</p>
            </div>
            <Button onClick={() => toast({ title: 'Changes Saved!', description: 'Your settings have been updated.' })}>
                <Save size={16} className="mr-2" /> Save Changes
            </Button>
          </div>

          {/* Main Content Area */}
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 items-start">
            {/* Left Navigation */}
            <aside className="lg:col-span-1">
          <div className="p-2 rounded-lg bg-card/50 border border-border/80 flex flex-row lg:flex-col gap-2 overflow-x-auto lg:overflow-visible">
                 {navItems.map(item => (
                    <SettingsNavItem
                        key={item.id}
                        icon={item.icon}
                        label={item.label}
                        isActive={activeSection === item.id}
                        onClick={() => setActiveSection(item.id as SettingsSection)}
                    />
                 ))}
              </div>
            </aside>

            {/* Right Content */}
            <section className="lg:col-span-3">
              {renderContent()}
            </section>
          </div>
          <Toaster />
        </main>
      </div>
    </div>
  );
}