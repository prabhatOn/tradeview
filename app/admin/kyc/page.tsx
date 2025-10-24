import React, { useEffect, useState } from 'react';
import Image from 'next/image';

type KycItem = {
  id: number;
  user_id: number;
  documentType: string;
  documentNumber?: string;
  documentFrontUrl?: string | null;
  documentBackUrl?: string | null;
  status?: string;
  rejectionReason?: string | null;
  submittedAt?: string | null;
  userEmail?: string;
  firstName?: string;
  lastName?: string;
  phoneNumber?: string | null;
};

async function fetchPending() {
  const res = await fetch('/api/kyc/admin/pending', { credentials: 'include' });
  if (!res.ok) throw new Error('Failed to load');
  return res.json();
}

async function reviewDocument(id: number, action: 'approve' | 'reject', reason?: string) {
  const res = await fetch(`/api/kyc/admin/${id}/review`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, reason })
  });
  return res.json();
}

export default function AdminKycPage() {
  const [items, setItems] = useState<KycItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [processingId, setProcessingId] = useState<number | null>(null);

  useEffect(() => {
    setLoading(true);
    fetchPending().then(r => {
      setItems(r.data || []);
      setLoading(false);
    }).catch((err: unknown) => {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
      setLoading(false);
    });
  }, []);

  const onApprove = async (id: number) => {
    setProcessingId(id);
    try {
      await reviewDocument(id, 'approve');
      setItems(items.filter(i => i.id !== id));
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      alert(msg || 'Failed');
    } finally {
      setProcessingId(null);
    }
  };

  const onReject = async (id: number) => {
    const reason = prompt('Reason for rejection (optional)');
    if (reason === null) return;
    setProcessingId(id);
    try {
      await reviewDocument(id, 'reject', reason || undefined);
      setItems(items.filter(i => i.id !== id));
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      alert(msg || 'Failed');
    } finally {
      setProcessingId(null);
    }
  };

  if (loading) return <div>Loading...</div>;
  if (error) return <div className="text-red-500">{error}</div>;

  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold mb-4">KYC Submissions (Pending)</h1>
      {items.length === 0 && <div>No pending KYC submissions</div>}
      <div className="space-y-4">
        {items.map(item => (
          <div key={item.id} className="border rounded p-4 bg-surface">
            <div className="flex justify-between items-start">
              <div>
                <div className="text-sm text-muted">Submitted: {item.submittedAt ? new Date(item.submittedAt).toLocaleString() : 'N/A'}</div>
                <div className="text-lg font-medium">{item.firstName} {item.lastName} &lt;{item.userEmail}&gt;</div>
                <div className="text-sm">Phone: {item.phoneNumber || '—'}</div>
              </div>
              <div className="space-x-2">
                <button disabled={processingId===item.id} onClick={() => onApprove(item.id)} className="px-3 py-1 bg-green-600 text-white rounded">Approve</button>
                <button disabled={processingId===item.id} onClick={() => onReject(item.id)} className="px-3 py-1 bg-red-600 text-white rounded">Reject</button>
              </div>
            </div>

            <div className="mt-3">
              <div className="font-semibold">Document Preview</div>
              <div className="mt-2">
                <div>Type: {item.documentType}</div>
                <div>Number: {item.documentNumber}</div>
                <div className="mt-2">Preview:</div>
                <div className="flex gap-4 mt-2">
                  {item.documentFrontUrl ? (
                    <div className="relative h-36 w-48">
                      <Image src={item.documentFrontUrl} alt="front" fill style={{ objectFit: 'contain' }} />
                    </div>
                  ) : <div className="h-36 w-48 border flex items-center justify-center">No front</div>}

                  {item.documentBackUrl ? (
                    <div className="relative h-36 w-48">
                      <Image src={item.documentBackUrl} alt="back" fill style={{ objectFit: 'contain' }} />
                    </div>
                  ) : <div className="h-36 w-48 border flex items-center justify-center">No back</div>}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
