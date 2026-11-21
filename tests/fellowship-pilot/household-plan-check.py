import contextlib
import importlib.util
import io
import json
import sys
import tempfile
from pathlib import Path
from unittest import mock

spec = importlib.util.spec_from_file_location('provision_household', Path(__file__).with_name('provision-household.py'))
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
accounts = [{'uid': uid, 'displayName': uid.title()} for uid in ['alpha', 'beta', 'gamma', 'delta']]
with mock.patch.object(module.urllib.request, 'urlopen') as open_request:
    open_request.return_value.__enter__.return_value.read.return_value = b'{}'
    module.cloud_request('https://identitytoolkit.googleapis.com/v1/projects/' + module.PROJECT + '/accounts:lookup',
                         'synthetic-owner-token', {'localId': ['alpha']})
    request = open_request.call_args.args[0]
    assert request.get_header('X-goog-user-project') == module.PROJECT
    assert request.get_header('Authorization') == 'Bearer synthetic-owner-token'
records = module.build_plan(accounts)
assert len(records) == 16
assert len([row for row in records if '/privateChats/' in row[1]]) == 6
assert len({row[1] for row in records}) == 16
assert all(row[1].startswith('groups/household-pilot') for row in records)
assert module.build_plan(list(reversed(accounts)))[-6:] == records[-6:]
for invalid in [accounts[:3], accounts + [accounts[0]], [accounts[0]] * 4]:
    try:
        module.build_plan(invalid)
        raise AssertionError('An invalid account set was accepted.')
    except ValueError:
        pass

scratch = Path(__file__).resolve().parents[2] / '.pilot-tmp'
scratch.mkdir(exist_ok=True)
with tempfile.TemporaryDirectory(dir=scratch) as directory:
    source = Path(directory) / 'accounts.json'
    source.write_text(json.dumps(accounts), encoding='utf8')
    existing = {records[1][1]: {'fields': {'role': {'stringValue': 'leader'}}},
                records[2][1]: {'fields': {'displayName': {'stringValue': 'Chosen name'}}}}
    writes = []
    def fake_request(url, token, payload=None, allow_missing=False):
        assert token == 'synthetic-owner-token'
        if 'identitytoolkit' in url:
            assert payload == {'localId': [item['uid'] for item in accounts]}
            return {'users': [{'localId': item['uid'], 'providerUserInfo': [{'providerId': 'google.com'}]} for item in accounts]}
        if url.endswith(':commit'):
            writes.extend(payload['writes'])
            return {}
        return existing.get(url.removeprefix(module.BASE + '/'))
    with mock.patch.object(sys, 'argv', ['provision-household.py', str(source), '--apply']), \
         mock.patch.object(module.subprocess, 'check_output', return_value='synthetic-owner-token'), \
         mock.patch.object(module, 'cloud_request', side_effect=fake_request), contextlib.redirect_stdout(io.StringIO()):
        module.main()
    assert len(writes) == 14
    assert all(write['currentDocument'] == {'exists': False} for write in writes)
    assert all(write['update']['name'].removeprefix(module.ROOT + '/') not in existing for write in writes)
    assert existing[records[1][1]]['fields']['role']['stringValue'] == 'leader'
    assert existing[records[2][1]]['fields']['displayName']['stringValue'] == 'Chosen name'
    def foreign_member(url, token, payload=None, allow_missing=False):
        if url.endswith('/members?pageSize=100'):
            return {'documents': [{'name': module.ROOT + '/groups/household-pilot/members/other-account'}]}
        return fake_request(url, token, payload, allow_missing)
    writes.clear()
    with mock.patch.object(sys, 'argv', ['provision-household.py', str(source), '--apply']), \
         mock.patch.object(module.subprocess, 'check_output', return_value='synthetic-owner-token'), \
         mock.patch.object(module, 'cloud_request', side_effect=foreign_member), contextlib.redirect_stdout(io.StringIO()):
        try:
            module.main()
            raise AssertionError('An unexpected household member was accepted.')
        except RuntimeError:
            pass
    assert not writes
    def unsafe_profile(url, token, payload=None, allow_missing=False):
        if url.endswith('/profiles?pageSize=100'):
            return {'documents': [{'name': module.ROOT + '/groups/household-pilot/profiles/alpha',
                                   'fields': {'displayName': {'stringValue': 'Alpha'}, 'email': {'stringValue': 'private@example.invalid'}}}]}
        return fake_request(url, token, payload, allow_missing)
    with mock.patch.object(sys, 'argv', ['provision-household.py', str(source), '--apply']), \
         mock.patch.object(module.subprocess, 'check_output', return_value='synthetic-owner-token'), \
         mock.patch.object(module, 'cloud_request', side_effect=unsafe_profile), contextlib.redirect_stdout(io.StringIO()):
        try:
            module.main()
            raise AssertionError('A profile containing contact fields was accepted.')
        except RuntimeError:
            pass
    assert not writes
print('Passed household setup: four distinct accounts, six stable pairings, isolated group, atomic missing-only writes and preserved existing roles/names.')
