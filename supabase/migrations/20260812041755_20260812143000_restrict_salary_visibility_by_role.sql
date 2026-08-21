/*
# Restrict salary visibility by role and ownership

1. Purpose
- Make salary amounts, salary settings, advances, salary records, loans, and loan installments private by default.
- Preserve full salary visibility for business owners, administrators, and finance staff.
- Allow every signed-in user, including system administrators, to view only their own salary information.

2. Modified tables
- `salary_settings`: salary rates and monthly salary are visible only to the row owner or approved salary-management roles.
- `salary_advances`: advance amounts are visible only to the employee or approved salary-management roles.
- `salary_records`: computed pay totals are visible only to the employee or approved salary-management roles.
- `employee_loans`: loan amounts and balances are visible only to the employee or approved salary-management roles.
- `loan_installments`: installment amounts are visible only when the related loan is visible to the caller.

3. Security changes
- Replaces broad SELECT policies that allowed system administrators to see other employees' salary data.
- `owner`, `admin`, and `finance` roles can see all salary rows.
- All other authenticated users can see only rows whose `profile_id` belongs to their own authenticated profile.
- No data is deleted or changed by this migration.

4. Important notes
- Row visibility is enforced in Supabase in addition to the application interface.
- System administrators retain access to non-salary features, but salary rows for other people remain hidden.
*/

DROP POLICY IF EXISTS "select_salary_settings" ON public.salary_settings;
CREATE POLICY "select_salary_settings" ON public.salary_settings
FOR SELECT TO authenticated
USING (
  profile_id = (SELECT p.id FROM public.profiles p WHERE p.user_id = auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.profiles actor
    WHERE actor.user_id = auth.uid()
      AND actor.roles && ARRAY['owner'::text, 'admin'::text, 'finance'::text]
  )
);

DROP POLICY IF EXISTS "select_salary_advances" ON public.salary_advances;
CREATE POLICY "select_salary_advances" ON public.salary_advances
FOR SELECT TO authenticated
USING (
  profile_id = (SELECT p.id FROM public.profiles p WHERE p.user_id = auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.profiles actor
    WHERE actor.user_id = auth.uid()
      AND actor.roles && ARRAY['owner'::text, 'admin'::text, 'finance'::text]
  )
);

DROP POLICY IF EXISTS "select_salary_records" ON public.salary_records;
CREATE POLICY "select_salary_records" ON public.salary_records
FOR SELECT TO authenticated
USING (
  profile_id = (SELECT p.id FROM public.profiles p WHERE p.user_id = auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.profiles actor
    WHERE actor.user_id = auth.uid()
      AND actor.roles && ARRAY['owner'::text, 'admin'::text, 'finance'::text]
  )
);

DROP POLICY IF EXISTS "select_employee_loans" ON public.employee_loans;
CREATE POLICY "select_employee_loans" ON public.employee_loans
FOR SELECT TO authenticated
USING (
  profile_id = (SELECT p.id FROM public.profiles p WHERE p.user_id = auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.profiles actor
    WHERE actor.user_id = auth.uid()
      AND actor.roles && ARRAY['owner'::text, 'admin'::text, 'finance'::text]
  )
);

DROP POLICY IF EXISTS "select_loan_installments" ON public.loan_installments;
CREATE POLICY "select_loan_installments" ON public.loan_installments
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.employee_loans loan
    WHERE loan.id = loan_installments.loan_id
      AND (
        loan.profile_id = (SELECT p.id FROM public.profiles p WHERE p.user_id = auth.uid())
        OR EXISTS (
          SELECT 1 FROM public.profiles actor
          WHERE actor.user_id = auth.uid()
            AND actor.roles && ARRAY['owner'::text, 'admin'::text, 'finance'::text]
        )
      )
  )
);