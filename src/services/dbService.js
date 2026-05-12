import { supabase } from '../lib/supabase';

export const dbService = {
  // --- Jobs ---
  async getJobs() {
    const { data, error } = await supabase
      .from('jobs')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data;
  },

  async createJob(jobData) {
    const { data, error } = await supabase
      .from('jobs')
      .insert([jobData])
      .select();
    if (error) throw error;
    return data[0];
  },

  // --- Applications ---
  async getApplicationsByJob(jobId) {
    const { data, error } = await supabase
      .from('applications')
      .select('*')
      .eq('job_id', jobId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data;
  },

  async getAllApplications() {
    const { data, error } = await supabase
      .from('applications')
      .select('*, jobs(title)')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data;
  },

  async getCandidateApplications(candidateEmail) {
    const { data, error } = await supabase
      .from('applications')
      .select('*, jobs(title, domain)')
      .eq('candidate_email', candidateEmail)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data;
  },

  async submitApplication(appData) {
    const { data, error } = await supabase
      .from('applications')
      .insert([appData])
      .select();
    if (error) throw error;
    return data[0];
  },

  async updateApplicationStatus(appId, status) {
    const { data, error } = await supabase
      .from('applications')
      .update({ status })
      .eq('id', appId)
      .select();
    if (error) throw error;
    return data[0];
  },

  async deleteJob(jobId) {
    const { error } = await supabase
      .from('jobs')
      .delete()
      .eq('id', jobId);
    if (error) throw error;
    return true;
  }
};
