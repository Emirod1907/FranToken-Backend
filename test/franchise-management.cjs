const assert = require("node:assert/strict");
const path = require("node:path");

module.exports = async function franchiseManagementChecks(context) {
  const {
    check,
    models,
    dispatch,
    back,
    front,
    adminToken,
    userToken,
    user,
    application,
    profile,
    adminClient,
    apiAccountRepository,
    asUser,
    asAdmin,
    hashPassword,
  } = context;
  const { franchiseRepository: client } = require(
    path.join(
      front,
      "src/features/franchises/repositories/franchise.repository",
    ),
  );
  const { createSuperadmin } = require(
    path.join(back, "src/services/superadmin.service"),
  );
  const appPath = `/api/account/applications/${application.id}`;
  const published = await models.FranchiseApplication.findByPk(application.id);
  const projectId = published.projectId;
  const projectPath = `/api/franchises/${projectId}`;
  let outsiderToken, legacyToken, editableId, request;

  await check(
    "superadmin explícito e idempotente, sin promoción ni cambio de contraseña",
    async () => {
      const input = {
        email: "bootstrap@example.test",
        password: "bootstrap-test-password",
        displayName: "Interno de prueba",
      };
      const created = await createSuperadmin(input);
      const internal = await models.User.findByPk(created.userId);
      const initialHash = internal.passwordHash;
      assert.equal(internal.role, "superadmin");
      assert.equal(created.created, true);
      assert.equal(
        (
          await createSuperadmin({
            ...input,
            password: "another-test-password",
          })
        ).created,
        false,
      );
      assert.equal(
        (await models.User.findByPk(created.userId)).passwordHash,
        initialHash,
      );
      const original = await models.User.findByPk(user.userId);
      await assert.rejects(
        createSuperadmin({ ...input, email: original.email }),
        /ya pertenece/,
      );
      assert.equal((await models.User.findByPk(user.userId)).role, "investor");
      assert.equal(
        (await models.User.findByPk(user.userId)).passwordHash,
        original.passwordHash,
      );
      await assert.rejects(
        createSuperadmin({ ...input, password: "short" }),
        /mínimo 12/,
      );
    },
  );

  await check(
    "registro no eleva permisos y admin legado no tiene acceso interno",
    async () => {
      const outsider = await dispatch("POST", "/api/auth/register", {
        email: "outsider@example.test",
        displayName: "Otro usuario",
        password: "testpass8",
        role: "superadmin",
      });
      assert.equal(outsider.status, 201);
      assert.equal(outsider.data.session.role, "investor");
      outsiderToken = outsider.data.token;
      await models.User.create({
        email: "legacy@example.test",
        displayName: "Admin legado",
        passwordHash: await hashPassword("testpass8"),
        role: "admin",
      });
      legacyToken = (
        await dispatch("POST", "/api/auth/login", {
          email: "legacy@example.test",
          password: "testpass8",
        })
      ).data.token;
      for (const token of [userToken, outsiderToken, legacyToken]) {
        for (const route of [
          "/api/admin/users",
          "/api/admin/applications",
          "/api/admin/distribution-requests",
        ])
          assert.equal(
            (await dispatch("GET", route, undefined, token)).status,
            403,
          );
        assert.equal(
          (
            await dispatch(
              "POST",
              `/api/admin/applications/${application.id}/publish`,
              { symbol: "NUEVA", totalUnits: "100" },
              token,
            )
          ).status,
          403,
        );
        assert.equal(
          (
            await dispatch(
              "POST",
              "/api/admin/distributions",
              { projectId, periodId: "2027-01", amount: "1" },
              token,
            )
          ).status,
          403,
        );
      }
      assert.equal((await dispatch("GET", "/api/franchises")).status, 401);
      assert.equal(
        (await dispatch("GET", "/api/admin/users", undefined, adminToken))
          .status,
        200,
      );
    },
  );

  await check(
    "el creador accede solo a sus solicitudes y franquicias; superadmin incluye fixtures",
    async () => {
      asUser();
      const detail = await client.detail(projectId);
      assert.equal(detail.application.id, application.id);
      assert.equal(detail.chain.status, 2);
      assert.equal(detail.capabilities.canExecuteDistribution, false);
      assert.equal(
        (await client.application(application.id)).capabilities.canEdit,
        false,
      );
      assert.equal(
        (await client.directory()).some((row) => row.project.id === projectId),
        true,
      );
      for (const token of [outsiderToken, legacyToken]) {
        assert.equal(
          (await dispatch("GET", appPath, undefined, token)).status,
          404,
        );
        assert.equal(
          (await dispatch("GET", projectPath, undefined, token)).status,
          404,
        );
        assert.equal(
          (
            await dispatch(
              "PATCH",
              `${projectPath}/operation`,
              { status: "cerrada" },
              token,
            )
          ).status,
          404,
        );
        assert.equal(
          (
            await dispatch(
              "GET",
              `${projectPath}/distribution-requests`,
              undefined,
              token,
            )
          ).status,
          404,
        );
      }
      assert.equal(
        (await dispatch("GET", "/api/franchises/havanna", undefined, userToken))
          .status,
        404,
      );
      assert.equal(
        (
          await dispatch(
            "GET",
            "/api/franchises/havanna",
            undefined,
            adminToken,
          )
        ).status,
        200,
      );
      const blocked = await dispatch(
        "PATCH",
        appPath,
        {
          version: published.version,
          description: "Cambio no permitido después de publicar.",
        },
        userToken,
      );
      assert.equal(blocked.status, 409);
      assert.equal(
        (await models.FranchiseApplication.findByPk(application.id))
          .description,
        published.description,
      );
    },
  );

  await check(
    "observaciones y correcciones invalidan aprobación y rechazan versiones antiguas",
    async () => {
      asUser();
      const created = await dispatch(
        "POST",
        "/api/account/applications",
        {
          franchiseName: "Franquicia corregible",
          sector: "Servicios",
          city: "Ciudad de prueba",
          country: "Argentina",
          totalCost: 10000,
          currency: "USD",
          description:
            "Solicitud para comprobar corrección y revisión concurrente.",
          operatorName: "Operadora de prueba",
          estimatedOpening: "2027-02",
        },
        userToken,
      );
      assert.equal(created.status, 201);
      editableId = created.data.application.id;
      const route = `/api/account/applications/${editableId}`;
      const review = `/api/admin/applications/${editableId}/review`;
      assert.equal(
        (
          await dispatch(
            "PATCH",
            route,
            { version: 1, userId: "otro" },
            userToken,
          )
        ).status,
        400,
      );
      assert.equal(
        (
          await dispatch(
            "PATCH",
            route,
            { version: 1, description: "Intento desde otra cuenta." },
            outsiderToken,
          )
        ).status,
        404,
      );
      assert.equal(
        (
          await dispatch(
            "PATCH",
            review,
            { status: "Observada", note: "Ampliar detalle", version: 1 },
            adminToken,
          )
        ).status,
        200,
      );
      let own = await client.application(editableId);
      assert.equal(own.application.status, "Observada");
      assert.equal(own.application.version, 2);
      const edit = {
        franchiseName: own.application.franchiseName,
        sector: own.application.sector,
        city: own.application.city,
        country: own.application.country,
        totalCost: own.application.totalCost,
        currency: own.application.currency,
        operatorName: own.application.operatorName,
        estimatedOpening: own.application.estimatedOpening,
        description: "Descripción corregida para reenviar a revisión interna.",
      };
      own = await client.saveApplication(
        editableId,
        own.application.version,
        edit,
      );
      assert.equal(own.application.status, "Enviada");
      assert.equal(own.application.version, 3);
      assert.equal(
        (
          await dispatch(
            "PATCH",
            route,
            {
              version: 2,
              description: "Una edición que ya quedó desactualizada.",
            },
            userToken,
          )
        ).status,
        409,
      );
      assert.equal(
        (
          await dispatch(
            "PATCH",
            review,
            { status: "Aprobada", note: "", version: 2 },
            adminToken,
          )
        ).status,
        409,
      );
      assert.equal(
        (
          await dispatch(
            "PATCH",
            review,
            { status: "Aprobada", note: "", version: 3 },
            adminToken,
          )
        ).status,
        200,
      );
      own = await client.saveApplication(editableId, 4, {
        ...edit,
        city: "Otra ciudad",
      });
      assert.equal(own.application.status, "Enviada");
      assert.equal(own.application.version, 5);
      assert.equal(
        own.history.some((event) => event.action === "application.reviewed"),
        true,
      );
      assert.equal(
        (
          await dispatch(
            "POST",
            `/api/admin/applications/${editableId}/publish`,
            { symbol: "EDIT", totalUnits: "100" },
            adminToken,
          )
        ).status,
        409,
      );
    },
  );

  await check(
    "una publicación reservada bloquea ediciones y se recupera con los mismos parámetros",
    async () => {
      const { env } = require(path.join(back, "src/config/env"));
      asAdmin();
      await adminClient.reviewFranchise(
        editableId,
        "Aprobada",
        "Datos admitidos",
        5,
      );
      const writes = env.blockchain.allowWrites;
      env.blockchain.allowWrites = false;
      try {
        await assert.rejects(
          adminClient.publishFranchise(editableId, "EDIT", "100"),
          /deshabilitadas/,
        );
      } finally {
        env.blockchain.allowWrites = writes;
      }
      asUser();
      const detail = await client.application(editableId);
      assert.ok(detail.application.projectId);
      assert.equal(detail.capabilities.canEdit, false);
      assert.equal(
        (
          await dispatch(
            "PATCH",
            `/api/account/applications/${editableId}`,
            { version: detail.application.version, city: "Otra más" },
            userToken,
          )
        ).status,
        409,
      );
      asAdmin();
      await assert.rejects(
        adminClient.publishFranchise(editableId, "OTRO", "100"),
        /otro símbolo/,
      );
      await adminClient.publishFranchise(editableId, "EDIT", "100");
      asUser();
      const managed = await client.detail(detail.application.projectId);
      assert.equal(managed.chain.status, 1);
      await client.operation(managed.project.id, "en_operacion");
      assert.equal((await client.detail(managed.project.id)).chain.status, 2);
    },
  );

  await check(
    "proponer no distribuye fondos y las correcciones requieren una revisión vigente",
    async () => {
      asUser();
      const before = await models.Distribution.count();
      assert.equal(
        (
          await dispatch(
            "POST",
            `${projectPath}/distribution-requests`,
            { periodId: "1999-12", amount: "1" },
            userToken,
          )
        ).status,
        400,
      );
      request = (
        await client.propose(projectId, {
          periodId: "2027-01",
          amount: "1.123456",
          memo: "Propuesta del creador",
        })
      ).request;
      assert.equal(request.status, "pending");
      assert.equal(request.amountMinor, "1123456");
      assert.equal(await models.Distribution.count(), before);
      assert.equal(
        (
          await dispatch(
            "POST",
            `${projectPath}/distribution-requests`,
            { periodId: "2027-01", amount: "9" },
            outsiderToken,
          )
        ).status,
        404,
      );
      assert.equal(
        (
          await dispatch(
            "POST",
            `${projectPath}/distribution-requests`,
            { periodId: "2027-01", amount: "9" },
            userToken,
          )
        ).status,
        409,
      );
      assert.equal(
        (
          await dispatch(
            "POST",
            `/api/admin/distribution-requests/${request.id}/execute`,
            { version: request.version },
            userToken,
          )
        ).status,
        403,
      );
      assert.equal(
        (
          await dispatch(
            "PATCH",
            `${projectPath}/distribution-requests/${request.id}`,
            { version: 1, amount: "2", periodId: "2027-02" },
            userToken,
          )
        ).status,
        400,
      );
      request = (
        await client.editRequest(projectId, request.id, request.version, {
          amount: "2.000001",
          memo: "Ajustada",
        })
      ).request;
      asAdmin();
      request = (
        await client.observeRequest(
          request.id,
          request.version,
          "Revisar el importe",
        )
      ).request;
      await assert.rejects(
        client.executeRequest(request.id, request.version),
        /debe corregirse/,
      );
      asUser();
      request = (
        await client.editRequest(projectId, request.id, request.version, {
          amount: "3.000001",
          memo: "Corregida",
        })
      ).request;
      assert.equal(request.status, "pending");
      assert.equal(request.reviewNote, "");
      assert.equal(await models.Distribution.count(), before);
    },
  );

  await check(
    "solo superadmin ejecuta contenido almacenado, conciliación no duplica reparto",
    async () => {
      asAdmin();
      assert.equal(
        (
          await dispatch(
            "POST",
            `/api/admin/distribution-requests/${request.id}/execute`,
            { version: request.version, amount: "999" },
            adminToken,
          )
        ).status,
        400,
      );
      await assert.rejects(
        client.executeRequest(request.id, 1),
        /datos cambiaron/,
      );
      const service = require(
        path.join(back, "src/services/distribution.service"),
      );
      const original = service.distribute;
      service.distribute = async () => {
        throw Error("Interrupción de prueba al ejecutar");
      };
      try {
        await assert.rejects(
          client.executeRequest(request.id, request.version),
          /Error interno/,
        );
      } finally {
        service.distribute = original;
      }
      let stored = await models.DistributionRequest.findByPk(request.id);
      assert.equal(stored.status, "executing");
      asUser();
      await assert.rejects(
        client.editRequest(projectId, request.id, stored.version, {
          amount: "9",
          memo: "No permitida",
        }),
        /ejecutando/,
      );
      asAdmin();
      const result = await client.executeRequest(request.id, request.version);
      assert.equal(result.request.status, "confirmed");
      assert.equal(result.request.amountMinor, "3000001");
      assert.equal(result.distribution.createdByUserId, undefined);
      const recovered = await client.executeRequest(request.id, 1);
      assert.equal(recovered.idempotent, true);
      assert.equal(recovered.distribution.id, result.distribution.id);
      assert.equal(
        await models.Distribution.count({
          where: { projectId, periodId: "2027-01" },
        }),
        1,
      );
      stored = await models.DistributionRequest.findByPk(request.id);
      assert.equal(
        stored.reviewedByUserId,
        (
          await models.User.findOne({
            where: { role: "superadmin", email: "admin@example.test" },
          })
        ).id,
      );
      asUser();
      const detail = await client.detail(projectId);
      assert.equal(
        detail.history.some(
          (event) => event.action === "distribution.confirmed",
        ),
        true,
      );
      assert.equal(JSON.stringify(detail).includes(profile.dni), false);
      assert.equal(
        detail.distributions.some((row) => row.id === result.distribution.id),
        true,
      );
    },
  );

  await check(
    "caída de blockchain conserva gestión SQL y no habilita nuevas operaciones",
    async () => {
      const { env } = require(path.join(back, "src/config/env"));
      const enabled = env.blockchain.enabled;
      env.blockchain.enabled = false;
      try {
        asUser();
        const detail = await client.detail(projectId);
        assert.equal(detail.chain, null);
        assert.ok(detail.networkError);
        assert.equal(detail.capabilities.canStart, false);
        assert.equal(detail.capabilities.canProposeDistribution, false);
        assert.ok(detail.requests.length);
        assert.ok((await client.directory()).length);
        assert.equal(
          (await client.application(editableId)).capabilities.canEdit,
          false,
        );
        await assert.rejects(
          client.propose(projectId, {
            periodId: "2027-02",
            amount: "1",
            memo: "",
          }),
          /no está habilitada/,
        );
      } finally {
        env.blockchain.enabled = enabled;
      }
    },
  );

  await check(
    "cierre por creador es terminal y publicar de nuevo no reabre ni cambia datos",
    async () => {
      asUser();
      const pending = (
        await client.propose(projectId, {
          periodId: "2027-02",
          amount: "1",
          memo: "Antes del cierre",
        })
      ).request;
      assert.equal(
        (
          await dispatch(
            "PATCH",
            `${projectPath}/operation`,
            { status: "publicada" },
            userToken,
          )
        ).status,
        400,
      );
      await client.operation(projectId, "cerrada");
      assert.equal((await client.detail(projectId)).chain.status, 3);
      await assert.rejects(
        client.operation(projectId, "en_operacion"),
        /no se reabre/,
      );
      asAdmin();
      await assert.rejects(
        client.executeRequest(pending.id, pending.version),
        /debe estar en operación/,
      );
      assert.equal(
        (await models.DistributionRequest.findByPk(pending.id)).status,
        "pending",
      );
      await adminClient.publishFranchise(application.id, "NUEVA", "100");
      assert.equal(
        (await models.Project.findByPk(projectId)).status,
        "cerrada",
      );
      assert.equal((await client.detail(projectId)).chain.status, 3);
      assert.equal(
        (await client.executeRequest(request.id, 1)).idempotent,
        true,
      );
    },
  );

  await check(
    "migración de franquicias repetible conserva roles, versiones, propuestas y compras",
    async () => {
      const { migrateFranchiseManagement } = require(
        path.join(back, "scripts/migrate-franchise-management"),
      );
      const counts = await Promise.all([
        models.User.count(),
        models.Purchase.count(),
        models.DistributionRequest.count(),
        models.FranchiseAuditEvent.count(),
      ]);
      const version = (await models.FranchiseApplication.findByPk(editableId))
        .version;
      await migrateFranchiseManagement();
      await migrateFranchiseManagement();
      assert.deepEqual(
        await Promise.all([
          models.User.count(),
          models.Purchase.count(),
          models.DistributionRequest.count(),
          models.FranchiseAuditEvent.count(),
        ]),
        counts,
      );
      assert.equal(
        (await models.FranchiseApplication.findByPk(editableId)).version,
        version,
      );
      assert.equal(
        (await models.User.findOne({ where: { email: "legacy@example.test" } }))
          .role,
        "admin",
      );
      assert.equal(
        (await models.DistributionRequest.findByPk(request.id)).status,
        "confirmed",
      );
      asUser();
      assert.ok(
        (await apiAccountRepository.getApplications(user.userId)).length >= 2,
      );
    },
  );
};
