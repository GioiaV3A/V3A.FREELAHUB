import React from 'react';
import { validatePublicLinkAction } from '@/app/actions/publicForm';
import PublicFormLayout from '@/components/PublicFormLayout';
import PublicFreelancerForm from '@/components/PublicFreelancerForm';
import { AlertTriangle, Lock } from 'lucide-react';

interface PageProps {
  params: Promise<{ token: string }>;
}

export default async function PublicAtualizarFreelaPage({ params }: PageProps) {
  const resolvedParams = await params;
  const token = resolvedParams.token;

  const validation = await validatePublicLinkAction(token);

  // If link is not active, render an KV-aligned clean error panel
  if (!validation.success || validation.status !== 'active') {
    let errorTitle = 'Link Inválido';
    let errorMessage = 'O link que você está tentando acessar é inválido ou expirou.';
    let Icon = AlertTriangle;

    if (validation.status === 'used') {
      errorTitle = 'Link Já Utilizado';
      errorMessage = 'Este link já foi utilizado. Caso precise atualizar informações, solicite um novo link ao RH.';
      Icon = Lock;
    } else if (validation.status === 'expired') {
      errorTitle = 'Link Expirado';
      errorMessage = 'Este link expirou. Solicite um novo acesso ao RH.';
      Icon = AlertTriangle;
    } else if (validation.status === 'revoked') {
      errorTitle = 'Link Desativado';
      errorMessage = 'Este link foi desativado pelo RH.';
      Icon = Lock;
    }

    return (
      <PublicFormLayout>
        <div className="text-center py-10 space-y-6 max-w-md mx-auto select-none animate-fade-in">
          <div className="w-16 h-16 bg-red-500/10 border border-red-200 rounded-full flex items-center justify-center mx-auto text-red-600">
            <Icon className="w-7 h-7" />
          </div>
          <div className="space-y-2">
            <h3 className="text-lg font-extrabold text-slate-900 uppercase tracking-wider">{errorTitle}</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              {errorMessage}
            </p>
          </div>
          <div className="pt-6 border-t border-[#E2E3E4]">
            <p className="text-[9px] text-slate-600 font-extrabold uppercase tracking-widest">
              Plataforma V3A Freela Hub
            </p>
          </div>
        </div>
      </PublicFormLayout>
    );
  }

  // Double check that freelancer data is available for update
  if (!validation.freelancerData) {
    return (
      <PublicFormLayout>
        <div className="text-center py-10 space-y-6 max-w-md mx-auto select-none animate-fade-in">
          <div className="w-16 h-16 bg-red-500/10 border border-red-200 rounded-full flex items-center justify-center mx-auto text-red-600">
            <AlertTriangle className="w-7 h-7" />
          </div>
          <div className="space-y-2">
            <h3 className="text-lg font-extrabold text-slate-900 uppercase tracking-wider">Erro no Cadastro</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Não foi possível carregar as informações do freelancer associadas a este link. Contate o RH.
            </p>
          </div>
        </div>
      </PublicFormLayout>
    );
  }

  return (
    <PublicFormLayout
      title="Atualização de Cadastro"
      subtitle="Atualize apenas as informações que deseja revisar. O time de RH da V3A analisará as alterações antes de atualizar a base oficial de freelancers."
    >
      <PublicFreelancerForm
        token={token}
        linkType="update_freelancer"
        linkId={validation.linkId || ''}
        functions={validation.functions || []}
        industries={validation.industries || []}
        initialData={validation.freelancerData}
      />
    </PublicFormLayout>
  );
}
