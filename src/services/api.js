// src/services/api.js
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

function getAuthHeader() {
  const token = localStorage.getItem('dpl_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function request(endpoint, options = {}) {
  const url = `${API_BASE_URL}${endpoint}`;
  const headers = {
    'Content-Type': 'application/json',
    ...getAuthHeader(),
    ...options.headers
  };

  try {
    const response = await fetch(url, {
      ...options,
      headers
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.message || `Lỗi HTTP ${response.status}`);
    }
    return data;
  } catch (err) {
    console.error(`❌ [API Error] ${endpoint}:`, err);
    throw err;
  }
}

export const api = {
  // 1. Auth
  async login(username, password) {
    const res = await request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password })
    });
    if (res.token) {
      localStorage.setItem('dpl_token', res.token);
      localStorage.setItem('dpl_user', JSON.stringify(res.user));
    }
    return res;
  },

  logout() {
    localStorage.removeItem('dpl_token');
    localStorage.removeItem('dpl_user');
  },

  getCurrentUser() {
    try {
      const raw = localStorage.getItem('dpl_user');
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  },

  // 2. Tournament
  async getTournamentData() {
    return request('/api/tournament/data');
  },

  async updateTournamentStatus(status) {
    return request('/api/tournament/status', {
      method: 'POST',
      body: JSON.stringify({ status })
    });
  },

  async updateTournamentConfig(config) {
    return request('/api/tournament/config', {
      method: 'POST',
      body: JSON.stringify({ config })
    });
  },

  async updateGroups(groupsData) {
    return request('/api/tournament/groups', {
      method: 'POST',
      body: JSON.stringify({ groupsData })
    });
  },

  async generateSchedule() {
    return request('/api/tournament/generate-schedule', {
      method: 'POST'
    });
  },

  async createKnockoutMatches(matchesList) {
    return request('/api/tournament/knockout', {
      method: 'POST',
      body: JSON.stringify({ matchesList })
    });
  },

  async resetKnockout() {
    return request('/api/tournament/reset-knockout', {
      method: 'POST'
    });
  },

  async resetTournament() {
    return request('/api/tournament/reset', {
      method: 'DELETE'
    });
  },

  // 3. Matches & Realtime
  async getMatches() {
    return request('/api/matches');
  },

  async updateMatch(id, updates) {
    return request(`/api/matches/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates)
    });
  },

  async addMatchEvent(id, eventData) {
    return request(`/api/matches/${id}/events`, {
      method: 'POST',
      body: JSON.stringify(eventData)
    });
  },

  async removeMatchEvent(id, eventId) {
    return request(`/api/matches/${id}/events/${eventId}`, {
      method: 'DELETE'
    });
  },

  async submitMatchReport(id, reportData) {
    return request(`/api/matches/${id}/submit`, {
      method: 'POST',
      body: JSON.stringify(reportData)
    });
  },

  async approveMatch(id, approvalData) {
    return request(`/api/matches/${id}/approve`, {
      method: 'POST',
      body: JSON.stringify(approvalData)
    });
  },

  async rejectMatch(id, reason) {
    return request(`/api/matches/${id}/reject`, {
      method: 'POST',
      body: JSON.stringify({ reason })
    });
  },

  // 4. Players
  async getPlayers() {
    return request('/api/players');
  },

  async saveTeamPlayers(team, playersList) {
    return request(`/api/players/${encodeURIComponent(team)}`, {
      method: 'POST',
      body: JSON.stringify({ playersList })
    });
  },

  async addTeamPlayer(team, player) {
    return request(`/api/players/${encodeURIComponent(team)}/add`, {
      method: 'POST',
      body: JSON.stringify(player)
    });
  },

  // 5. Discipline & Suspensions
  async getSuspensions() {
    return request('/api/discipline/suspensions');
  },

  async applySuspension(banData) {
    return request('/api/discipline/ban', {
      method: 'POST',
      body: JSON.stringify(banData)
    });
  },

  async removeSuspension(pKey) {
    return request(`/api/discipline/ban/${encodeURIComponent(pKey)}`, {
      method: 'DELETE'
    });
  },

  async pardonViolation(vKey) {
    return request('/api/discipline/pardon', {
      method: 'POST',
      body: JSON.stringify({ vKey })
    });
  },

  // 6. Backup & Restore
  async exportBackup() {
    const token = localStorage.getItem('dpl_token');
    const response = await fetch(`${API_BASE_URL}/api/backup/export`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {}
    });
    return response.blob();
  },

  async importBackup(backupData) {
    return request('/api/backup/import', {
      method: 'POST',
      body: JSON.stringify({ backupData })
    });
  }
};
