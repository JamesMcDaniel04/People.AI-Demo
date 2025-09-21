import { TechSaasTemplate } from './techSaasTemplate.js';
import { RetailOmnichannelTemplate } from './retailOmnichannelTemplate.js';
import { HealthcarePlatformTemplate } from './healthcarePlatformTemplate.js';
import { FinancialServicesTemplate } from './financialServicesTemplate.js';

const factories = new Map([
  ['tech_saas_expansion', () => new TechSaasTemplate()],
  ['retail_omnichannel', () => new RetailOmnichannelTemplate()],
  ['healthcare_platform', () => new HealthcarePlatformTemplate()],
  ['financial_services_modernization', () => new FinancialServicesTemplate()]
]);

export const templateRegistry = {
  get(templateId) {
    const factory = factories.get(templateId);
    return factory ? factory() : null;
  },
  listMetadata() {
    return Array.from(factories.keys()).map(id => {
      const template = factories.get(id)();
      return template.metadata;
    });
  },
  has(templateId) {
    return factories.has(templateId);
  }
};
