import { id as sampleId, run as sampleRun } from './sample';
import { id as ormId, run as ormRun } from './detect_orm_pydantic';
import { id as dbRawId, run as dbRawRun } from './detect_db_raw_in_api';
import { id as blockingId, run as blockingRun } from './detect_blocking_in_async';
import { id as importLayerId, run as importLayerRun } from './detect_import_layer_violation';
import { id as crossSvcId, run as crossSvcRun } from './detect_cross_service_import';
import { id as clientDivId, run as clientDivRun } from './detect_client_divergence_http';
import { id as dbDivId, run as dbDivRun } from './detect_db_access_divergence';
import { id as loggerDivId, run as loggerDivRun } from './detect_logger_divergence';
import { id as jsonDivId, run as jsonDivRun } from './detect_json_divergence';
import { id as pydVId, run as pydVRun } from './detect_pydantic_mixed_versions';
import { id as routeMissId, run as routeMissRun } from './detect_route_missing_in_code';
import { id as no2xxId, run as no2xxRun } from './detect_no_2xx_in_spec';
import { id as paramMismatchId, run as paramMismatchRun } from './detect_param_mismatch';
import { id as schemaFieldId, run as schemaFieldRun } from './detect_schema_field_mismatch';
import { id as responseEnvId, run as responseEnvRun } from './detect_response_envelope_mismatch';
import { id as errorFmtId, run as errorFmtRun } from './detect_error_format_divergence';
import { id as pagDivId, run as pagDivRun } from './detect_pagination_divergence';
import { id as dbTypeId, run as dbTypeRun } from './detect_db_type_mismatch';
import { id as enumValId, run as enumValRun } from './detect_enum_values_mismatch';
import { id as constraintId, run as constraintRun } from './detect_constraint_mismatch';
import { id as fkId, run as fkRun } from './detect_fk_mismatch';
import { id as dbNamingId, run as dbNamingRun } from './detect_db_naming_mismatch';
import { id as idTypeId, run as idTypeRun } from './detect_id_type_divergence';
import { id as moneyId, run as moneyRun } from './detect_money_precision_risk';
import { id as dtTzId, run as dtTzRun } from './detect_datetime_tz_mismatch';
import { id as weakSemId, run as weakSemRun } from './detect_weak_semantic_type';

export const heuristics = [
  { id: sampleId, run: sampleRun, extensions: ['.py', '.md'] },
  { id: ormId, run: ormRun, extensions: ['.py'] },
  { id: dbRawId, run: dbRawRun, extensions: ['.py'] },
  { id: blockingId, run: blockingRun, extensions: ['.py'] },
  { id: importLayerId, run: importLayerRun, extensions: ['.py'] },
  { id: crossSvcId, run: crossSvcRun, extensions: ['.py'] },
  { id: clientDivId, run: clientDivRun, extensions: ['.py'] },
  { id: dbDivId, run: dbDivRun, extensions: ['.py'] },
  { id: loggerDivId, run: loggerDivRun, extensions: ['.py'] },
  { id: jsonDivId, run: jsonDivRun, extensions: ['.py'] },
  { id: pydVId, run: pydVRun, extensions: ['.py'] },
  { id: routeMissId, run: routeMissRun, extensions: ['.py'] },
  { id: no2xxId, run: no2xxRun, extensions: ['.json', '.yaml', '.yml'] },
  { id: paramMismatchId, run: paramMismatchRun, extensions: ['.py'] },
  { id: schemaFieldId, run: schemaFieldRun, extensions: ['.py'] },
  { id: responseEnvId, run: responseEnvRun, extensions: ['.py'] },
  { id: errorFmtId, run: errorFmtRun, extensions: ['.py'] },
  { id: pagDivId, run: pagDivRun, extensions: ['.py'] },
  { id: dbTypeId, run: dbTypeRun, extensions: ['.sql', '.py'] },
  { id: enumValId, run: enumValRun, extensions: ['.py', '.sql'] },
  { id: constraintId, run: constraintRun, extensions: ['.py', '.sql'] },
  { id: fkId, run: fkRun, extensions: ['.py', '.sql'] },
  { id: dbNamingId, run: dbNamingRun, extensions: ['.py', '.sql'] },
  { id: idTypeId, run: idTypeRun, extensions: ['.py'] },
  { id: moneyId, run: moneyRun, extensions: ['.py'] },
  { id: dtTzId, run: dtTzRun, extensions: ['.py'] },
  { id: weakSemId, run: weakSemRun, extensions: ['.py'] },
  // env-related detectors
  { id: 'env_missing_decl', run: (c:string, r:string) => require('./detect_env_missing_decl').run(c, r) },
  { id: 'env_unused', run: (c:string, r:string) => require('./detect_env_unused').run(c, r) },
  { id: 'env_prefix_divergence', run: (c:string, r:string) => require('./detect_env_prefix_divergence').run(c, r) },
  { id: 'secret_hardcoded', run: (c:string, r:string) => require('./detect_secret_hardcoded').run(c, r) },
  { id: 'cyclomatic_complexity', run: (c:string, r:string) => require('./detect_cyclomatic_complexity').run(c, r) },
  { id: 'code_smell_function_length', run: (c:string, r:string) => require('./detect_code_smell_function_length').run(c, r) },
  { id: 'code_smell_many_params', run: (c:string, r:string) => require('./detect_code_smell_many_params').run(c, r) },
  { id: 'api_raw_dict_response', run: (c:string, r:string) => require('./detect_api_raw_dict_response').run(c, r) },
  { id: 'import_map', run: (c:string, r:string) => require('./detect_import_map').run(c, r) },
  { id: 'repo_import_graph', run: (c:string, r:string) => require('./detect_repo_import_graph').run(c, r) },
  { id: 'feature_flag_divergence', run: (c:string, r:string) => require('./detect_feature_flag_divergence').run(c, r) },
  { id: 'import_without_dependency', run: (c:string, r:string) => require('./detect_import_without_dependency').run(c, r) },
  { id: 'dependency_major_conflict', run: (c:string, r:string) => require('./detect_dependency_major_conflict').run(c, r) },
  { id: 'unpinned_core_dep', run: (c:string, r:string) => require('./detect_unpinned_core_dep').run(c, r) },
  { id: 'log_format_divergence', run: (c:string, r:string) => require('./detect_log_format_divergence').run(c, r) },
  { id: 'missing_correlation_id', run: (c:string, r:string) => require('./detect_missing_correlation_id').run(c, r) },
  { id: 'log_policy_mismatch', run: (c:string, r:string) => require('./detect_log_policy_mismatch').run(c, r) },
  { id: 'timeout_divergence', run: (c:string, r:string) => require('./detect_timeout_divergence').run(c, r) },
  { id: 'retry_divergence', run: (c:string, r:string) => require('./detect_retry_divergence').run(c, r) },
  { id: 'db_pool_divergence', run: (c:string, r:string) => require('./detect_db_pool_divergence').run(c, r) },
  { id: 'constant_value_divergence', run: (c:string, r:string) => require('./detect_constant_value_divergence').run(c, r) },
  { id: 'mapping_divergence', run: (c:string, r:string) => require('./detect_mapping_divergence').run(c, r) },
  { id: 'event_topic_divergence', run: (c:string, r:string) => require('./detect_event_topic_divergence').run(c, r) },
  { id: 'module_naming_violation', run: (c:string, r:string) => require('./detect_module_naming_violation').run(c, r) },
  { id: 'pluralization_divergence', run: (c:string, r:string) => require('./detect_pluralization_divergence').run(c, r) },
  { id: 'anchor_missing_in_anchorized_area', run: (c:string, r:string) => require('./detect_anchor_missing_in_anchorized_area').run(c, r) },
];

for (const h of heuristics) {
  try { require('../heuristicRegistry').register(h); } catch (e) {}
}


