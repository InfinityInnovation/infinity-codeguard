'use client';

import {
  createProjectSchema,
  createRepositorySchema,
  projectSummarySchema,
  repositorySummarySchema,
} from '@codeguard/contracts';
import type { CreateProjectInput, CreateRepositoryInput } from '@codeguard/contracts';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { apiRequest } from '../../../lib/api';
import { workspaceQueryKeys } from '../model/query-keys';

export function RepositoryForm({
  organizationId,
  projectId,
}: {
  organizationId: string;
  projectId: string;
}) {
  const t = useTranslations('dashboard');
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const form = useForm<CreateRepositoryInput>({
    resolver: zodResolver(createRepositorySchema),
    defaultValues: { provider: 'GITHUB', defaultBranch: 'main' },
  });
  const create = useMutation({
    mutationFn: (input: CreateRepositoryInput) =>
      apiRequest(
        `/organizations/${organizationId}/projects/${projectId}/repositories`,
        repositorySummarySchema,
        { method: 'POST', body: JSON.stringify(input) },
      ),
    onSuccess: async () => {
      form.reset({ provider: 'GITHUB', defaultBranch: 'main' });
      setOpen(false);
      await queryClient.invalidateQueries({
        queryKey: workspaceQueryKeys.repositories(organizationId, projectId),
      });
    },
  });
  if (!open)
    return (
      <button className="sq-primary" onClick={() => setOpen(true)}>
        + {t('addRepository')}
      </button>
    );
  return (
    <form
      className="cg-repo-form"
      onSubmit={(event) => void form.handleSubmit((input) => create.mutate(input))(event)}
    >
      <input placeholder={t('repositoryName')} {...form.register('name')} />
      <input
        type="url"
        placeholder="https://github.com/org/repository"
        {...form.register('remoteUrl')}
      />
      <div>
        <select {...form.register('provider')}>
          <option value="GITHUB">GitHub</option>
          <option value="GITLAB">GitLab</option>
          <option value="BITBUCKET">Bitbucket</option>
          <option value="AZURE_DEVOPS">Azure DevOps</option>
          <option value="OTHER">{t('other')}</option>
        </select>
        <input placeholder={t('defaultBranch')} {...form.register('defaultBranch')} />
      </div>
      {Object.values(form.formState.errors)[0]?.message && (
        <span className="error-text">{Object.values(form.formState.errors)[0]?.message}</span>
      )}
      {create.error && <span className="error-text">{create.error.message}</span>}
      <footer>
        <button type="button" onClick={() => setOpen(false)}>
          {t('cancel')}
        </button>
        <button className="sq-primary" disabled={create.isPending}>
          {t('add')}
        </button>
      </footer>
    </form>
  );
}

export function ProjectForm({ organizationId }: { organizationId: string }) {
  const t = useTranslations('dashboard');
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const form = useForm<CreateProjectInput>({ resolver: zodResolver(createProjectSchema) });
  const create = useMutation({
    mutationFn: (input: CreateProjectInput) =>
      apiRequest(`/organizations/${organizationId}/projects`, projectSummarySchema, {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: async () => {
      form.reset();
      setOpen(false);
      await queryClient.invalidateQueries({
        queryKey: workspaceQueryKeys.projects(organizationId),
      });
    },
  });
  if (!open)
    return (
      <button className="sq-primary" onClick={() => setOpen(true)}>
        + {t('createProject')}
      </button>
    );
  return (
    <form
      className="sq-create"
      onSubmit={(event) => void form.handleSubmit((input) => create.mutate(input))(event)}
    >
      <label>
        <span>{t('projectName')}</span>
        <input autoFocus {...form.register('name')} placeholder={t('projectNamePlaceholder')} />
      </label>
      <small>{t('identifierGenerated')}</small>
      {form.formState.errors.name && (
        <span className="error-text">{form.formState.errors.name.message}</span>
      )}
      {create.error && <span className="error-text">{create.error.message}</span>}
      <div>
        <button type="button" onClick={() => setOpen(false)}>
          {t('cancel')}
        </button>
        <button className="sq-primary" disabled={create.isPending}>
          {t('create')}
        </button>
      </div>
    </form>
  );
}
