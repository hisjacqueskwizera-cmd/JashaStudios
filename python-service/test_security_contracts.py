from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def test_suspended_accounts_are_blocked_by_owner_rls():
    migration = (ROOT / "supabase/migrations/20261108001100_security_hardening.sql").read_text()
    assert "public.is_active_account()" in migration
    assert "account_status = 'active'" in migration
    assert "user_id = auth.uid() and public.is_active_account()" in migration
    assert "profiles_owner_update" in migration
    assert "studio_assets_generated_owner_read" in migration
    assert "projects_owner_insert" in migration
    assert "projects_owner_update" in migration
    assert "projects_owner_delete" in migration
    assert "backgrounds_admin_manage" in migration


def test_suspended_accounts_cannot_use_existing_paired_devices():
    migration = (ROOT / "supabase/migrations/20261108001100_security_hardening.sql").read_text()
    assert "create or replace function public.authorize_paired_device" in migration
    assert "join public.profiles p on p.id = d.user_id and p.account_status = 'active'" in migration


def test_pairing_challenge_creation_checks_active_account_inside_definer_rpc():
    migration = (ROOT / "supabase/migrations/20261108001100_security_hardening.sql").read_text()
    assert "create or replace function public.create_pairing_challenge" in migration
    assert "not public.is_active_account()" in migration


def test_camera_upload_requires_a_bounded_request_body():
    route = (ROOT / "src/app/api/camera/capture/route.ts").read_text()
    assert "content-length" in route
    assert "MAX_BYTES+256000" in route
    assert "A bounded Content-Length header is required" in route


def test_transformation_and_payment_remain_disabled_by_default():
    env = (ROOT / ".env.example").read_text()
    assert "TRANSFORMATION_ENABLED=false" in env
    assert "PAYMENT_PROVIDER=unconfigured" in env
