import axios, { AxiosInstance, AxiosError } from 'axios';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

class ApiClient {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: API_BASE,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    this.client.interceptors.response.use(
      (response) => response,
      (error: AxiosError) => {
        console.error('API Error:', error.response?.status, error.response?.data);
        return Promise.reject(error);
      }
    );
  }

  // Agents
  async getAgents() {
    const { data } = await this.client.get('/agents');
    return data;
  }

  async getAgent(id: string) {
    const { data } = await this.client.get(`/agents/${id}`);
    return data;
  }

  async executeAgent(agentType: string, action: string, payload?: Record<string, unknown>) {
    const { data } = await this.client.post('/agents/execute', { agentType, action, payload });
    return data;
  }

  async getAgentTasks(agentId: string) {
    const { data } = await this.client.get(`/agents/${agentId}/tasks`);
    return data;
  }

  // Projects
  async getProjects(status?: string) {
    const { data } = await this.client.get('/projects', { params: { status } });
    return data;
  }

  async getProject(id: string) {
    const { data } = await this.client.get(`/projects/${id}`);
    return data;
  }

  async createProject(data: { opportunityId: string; name: string; brandData?: Record<string, unknown> }) {
    const { data: project } = await this.client.post('/projects', data);
    return project;
  }

  async updateProject(id: string, data: Partial<{ name: string; brandData: Record<string, unknown>; status: string; websiteUrl: string; repositoryUrl: string }>) {
    const { data: project } = await this.client.patch(`/projects/${id}`, data);
    return project;
  }

  async getProjectTasks(projectId: string) {
    const { data } = await this.client.get(`/projects/${projectId}/tasks`);
    return data;
  }

  // Opportunities
  async getOpportunities(status?: string) {
    const { data } = await this.client.get('/opportunities', { params: { status } });
    return data;
  }

  async getOpportunity(id: string) {
    const { data } = await this.client.get(`/opportunities/${id}`);
    return data;
  }

  async createOpportunity(data: { name: string; model: string; description?: string; score?: number; researchData?: Record<string, unknown> }) {
    const { data: opportunity } = await this.client.post('/opportunities', data);
    return opportunity;
  }

  async updateOpportunity(id: string, data: Partial<{ name: string; model: string; description: string; score: number; status: string; researchData: Record<string, unknown>; validationData: Record<string, unknown> }>) {
    const { data: opportunity } = await this.client.patch(`/opportunities/${id}`, data);
    return opportunity;
  }

  // CRM
  async getContacts(projectId?: string, status?: string) {
    const { data } = await this.client.get('/crm/contacts', { params: { projectId, status } });
    return data;
  }

  async getContact(id: string) {
    const { data } = await this.client.get(`/crm/contacts/${id}`);
    return data;
  }

  async createContact(data: { projectId: string; name: string; email?: string; phone?: string; company?: string; role?: string; status?: string; source?: string; notes?: string }) {
    const { data: contact } = await this.client.post('/crm/contacts', data);
    return contact;
  }

  async updateContact(id: string, data: Partial<{ name: string; email: string; phone: string; company: string; role: string; status: string; source: string; notes: string }>) {
    const { data: contact } = await this.client.patch(`/crm/contacts/${id}`, data);
    return contact;
  }

  async getDeals(projectId?: string, stage?: string) {
    const { data } = await this.client.get('/crm/deals', { params: { projectId, stage } });
    return data;
  }

  async getDeal(id: string) {
    const { data } = await this.client.get(`/crm/deals/${id}`);
    return data;
  }

  async createDeal(data: { projectId: string; contactId?: string; title: string; stage?: string; value?: number; probability?: number; expectedCloseDate?: string; notes?: string }) {
    const { data: deal } = await this.client.post('/crm/deals', data);
    return deal;
  }

  async updateDeal(id: string, data: Partial<{ projectId: string; contactId: string; title: string; stage: string; value: number; probability: number; expectedCloseDate: string; notes: string }>) {
    const { data: deal } = await this.client.patch(`/crm/deals/${id}`, data);
    return deal;
  }

  // Financial
  async getTransactions(projectId?: string, type?: string) {
    const { data } = await this.client.get('/financial/transactions', { params: { projectId, type } });
    return data;
  }

  async createTransaction(data: { projectId: string; type: 'revenue' | 'expense'; amount: number; currency?: string; category: string; description?: string; date: string; reference?: string; tags?: string[] }) {
    const { data: transaction } = await this.client.post('/financial/transactions', data);
    return transaction;
  }

  async getFinancialSummary(projectId: string, period?: string) {
    const { data } = await this.client.get('/financial/summary', { params: { projectId, period } });
    return data;
  }

  // Marketing
  async getMarketingContent(projectId?: string, status?: string) {
    const { data } = await this.client.get('/marketing/content', { params: { projectId, status } });
    return data;
  }

  // Automation
  async getAutomationRuns(workflowName?: string, status?: string) {
    const { data } = await this.client.get('/automation/runs', { params: { workflowName, status } });
    return data;
  }

  // Reports
  async getReports(agentId?: string, type?: string) {
    const { data } = await this.client.get('/reports', { params: { agentId, type } });
    return data;
  }

  // Alerts
  async createAlert(data: { type: string; message: string; severity: 'low' | 'medium' | 'high' | 'critical' }) {
    const { data: alert } = await this.client.post('/alerts', data);
    return alert;
  }

  async getAlerts() {
    const { data } = await this.client.get('/alerts');
    return data;
  }
}

export const api = new ApiClient();