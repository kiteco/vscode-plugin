'use strict';

const {StateController} = require('kite-installer');
const {promisifyRequest, promisifyReadResponse} = require('./utils');

const Plan = {
  can(feature) {
    return this.plan && this.plan.features && this.plan.features[feature] != null
      ? this.plan.features[feature]
      : this.isActivePro();
  },

  isEnterprise() {
    return this.plan && this.plan.active_subscription === 'enterprise';
  },

  isPro() {
    return this.plan && this.plan.active_subscription === 'pro';
  },

  isActive() {
    return this.plan && this.plan.status === 'active';
  },

  isTrialing() {
    return this.plan && this.plan.status === 'trialing' && this.remainingTrialDays() > 0;
  },

  isActivePro() {
    return this.isPro() && (this.isActive() || this.isTrialing());
  },

  hasStartedTrial() {
    return this.plan && this.plan.started_kite_pro_trial;
  },

  hasReferralCredits() {
    return this.isPro()
        && this.hasStartedTrial()
        && this.remainingTrialDays() > 0
        && this.daysCredited() > 0;
  },

  remainingTrialDays() {
    return this.plan && this.plan.trial_days_remaining;
  },

  referralsCredited() {
    return this.plan ? this.plan.referrals_credited : undefined;
  },

  referralsCredits() {
    return this.plan ? this.plan.max_referral_credits : undefined;
  },

  daysCredited() {
    return this.plan ? this.plan.referral_days_credited : undefined;
  },

  planPath() {
    return [
      '/clientapi/plan',
      `localtoken=${StateController.client.LOCAL_TOKEN}`,
    ].join('?');
  },

  queryPlan() {
    const path = this.planPath();
    return promisifyRequest(StateController.client.request({path}))
    .then(resp => {
      if (resp.statusCode !== 200) {
        throw new Error(`${resp.statusCode} status at ${path}`);
      }
      return promisifyReadResponse(resp);
    })
    .then(data => {
      this.plan = JSON.parse(data);

      return this.plan;
    });
  },
};

module.exports = Plan;
