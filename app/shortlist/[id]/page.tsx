'use client';

import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';

export default function ShortlistRedirectPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  useEffect(() => {
    if (id) {
      router.replace(`/?tab=Shortlist&jobId=${id}`);
    } else {
      router.replace('/?tab=Shortlist');
    }
  }, [id, router]);

  return (
    <div className="min-h-screen bg-bg-app flex items-center justify-center text-text-primary p-6">
      <span className="text-sm font-bold animate-pulse">Redirecionando para o Workflow...</span>
    </div>
  );
}
